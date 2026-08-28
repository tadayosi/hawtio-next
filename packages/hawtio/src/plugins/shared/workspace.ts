import { userService } from '@hawtiosrc/auth'
import { configManager, eventService, JmxConfig, Logger } from '@hawtiosrc/core'
import { jolokiaService } from '@hawtiosrc/plugins/shared/jolokia-service'
import Jolokia, { JolokiaErrorResponse, JolokiaFetchErrorResponse, JolokiaSuccessResponse } from 'jolokia.js'
import { pluginName } from './globals'
import { MBeanNode, MBeanTree } from './tree'
import { SimpleRequestOptions } from '@jolokia.js/simple'

const log = Logger.get(`${pluginName}-workspace`)

/**
 * Name of the server MBean that provides an update counter for plugin registry.
 * It is updated whenever new plugin is discovered or dynamically added.
 */
const HAWTIO_REGISTRY_MBEAN = 'hawtio:type=Registry'

/**
 * Name of the server MBean that provides an update counter for JMX MBean registry.
 * It is updated whenever an MBean is registered or unregistered from the MBean server.
 */
const HAWTIO_TREE_WATCHER_MBEAN = 'hawtio:type=TreeWatcher'

/**
 * Expansion requires more than 2 states since the expandAll
 * must be removed completely to defer to the expanded state
 * of each data node
 */
export enum ExpansionValue {
  /**
   * should revert to the expanded state of the data
   */
  Default,
  /**
   * all data should be expanded
   */
  ExpandAll,
  /**
   * all data should be collapsed
   */
  CollapseAll,
}

export interface IWorkspace {
  // ---- JMX tree management backed by Jolokia list operation

  /**
   * Get the global, single JMX tree of the workspace. The returned promise eventually
   * resolves into a tree. We can rely on the tree if `hasErrors()` returns `false`, otherwise
   * the tree will be empty.
   */
  getTree(): Promise<MBeanTree>

  /**
   * Are there any error related to the MBean tree from the workspace?
   */
  hasErrors(): Promise<boolean>

  /**
   * Return an array of found errors found when the MBean tree was loaded
   */
  getErrors(): Promise<Error[]>

  /**
   * Ask the workspace to reload the tree. Can happen on demand or with the active
   * TreeWatcher that monitors tree changes at the server side.
   */
  refreshTree(): Promise<void>

  // ---- UI support methods for tree navigation

  /**
   * Change _expanded_ status for a single node.
   * Expanding last collapsed node or collapsing last expanded node may switch the global status for all nodes,
   * so it's nice to return it.
   * @param expanded
   * @param item
   * @return
   */
  expand(expanded: boolean, item: MBeanNode): void

  /**
   * Change _expanded_ status for all nodes
   * @param expanded
   * @param domain optionally expand nodes only under given domain
   */
  expandAll(expanded: boolean, domain?: string): void

  /**
   * Clear "expand all" status for a domain
   * @param domain
   */
  clearExpandAll(domain: string): void

  /**
   * Whether the "all expanded" state is set. Any individual expand/collapse clears this flag
   * @param domain optionally only check under given domain
   */
  allExpanded(domain?: string): ExpansionValue

  // ---- methods to access and navigate already loaded and _stable_ JMX tree without changing it

  /**
   * Returns true if this workspace has any MBeans at all.
   */
  hasMBeans(): Promise<boolean>

  /**
   * Generic search method for nodes (domains or MBeans) matching the criteria
   * @param domainName
   * @param properties
   */
  treeContainsDomainAndProperties(domainName: string, properties?: Record<string, unknown>): Promise<boolean>

  /**
   * Finds MBeans in the workspace based on the domain name and properties.
   *
   * @param domainName
   * @param properties
   */
  findMBeans(domainName: string, properties: Record<string, unknown>): Promise<MBeanNode[]>
}

class Workspace implements IWorkspace {
  private tree?: Promise<MBeanTree>

  // a workspace-managed set of ids for expanded folder nodes, which helps preserving
  // UI status between tree reloads
  private expandedFolders = new Set<string>()
  // a set updated after each tree reload to keep IDs of each folder of the tree for better
  // handling of expand-all/collapse-all events
  private allFolders = new Map<string, MBeanNode>()
  private domainFolders = new Map<string, Map<string, MBeanNode>>()
  private domainExpanded = new Map<string, ExpansionValue>()

  // Jolokia job handle (a number) for monitoring hawtio:type=Registry
  private pluginRegisterHandle?: Promise<number>
  // actual counter value from the plugin registry watcher
  private pluginUpdateCounter?: number

  // Jolokia job handle (a number) for monitoring hawtio:type=TreeWatcher
  private treeWatchRegisterHandle?: Promise<number>
  // actual counter value from the JMX tree watcher
  private treeWatcherCounter?: number

  private _errors: Error[] = []

  // ---- JMX tree management backed by Jolokia list operation

  async hasErrors(): Promise<boolean> {
    await this.getTree()
    return this._errors.length > 0
  }

  async getErrors(): Promise<Error[]> {
    await this.getTree()
    return this._errors
  }

  addError(error: Error) {
    this._errors.push(error)
  }

  async refreshTree() {
    this.tree = undefined
    this._errors = []
    // no need to keep the old tree. Entire UI state to reapply on the new tree (collapsed/expanded)
    // is kept in separate structure
    await this.getTree()
    eventService.refresh()
  }

  getTree(): Promise<MBeanTree> {
    if (this.tree) {
      return this.tree
    }

    this.tree = this.loadTree()
    return this.tree
  }

  /**
   * Main tree loading method. It calls Jolokia `list` operation and transforms semi-flat collection of domains
   * and MBeans into a tree reflecting the structure of MBean names (based on the `key=value` elements of the
   * MBean name)
   * @private
   */
  private async loadTree(): Promise<MBeanTree> {
    if (!(await userService.isLogin())) {
      this.addError(new Error('User needs to have logged in to use workspace'))
      throw new Error('User needs to have logged in to use workspace')
    }

    const config = await this.getConfig()
    if (config.workspace === false || (typeof config.workspace !== 'boolean' && config.workspace?.length === 0)) {
      // TODO Should this set the error??
      return MBeanTree.createEmpty(pluginName)
    }
    const mbeanPaths = config.workspace && typeof config.workspace !== 'boolean' ? config.workspace : []

    log.debug('Load JMX MBean tree:', mbeanPaths)
    const options: SimpleRequestOptions = {
      ignoreErrors: true,
      error: (response: JolokiaErrorResponse) => {
        this.addError(
          new Error(`Error - fetching JMX tree: ${response.error_type} ${response.error} ${response.error_value}`),
        )
        log.debug('Error - fetching JMX tree:', response)
      },
      fetchError: (response: Response | null, error: DOMException | TypeError | string | null) => {
        const text = response?.statusText || error
        const err = new Error(`Ajax error - fetching JMX tree: ${text}`)
        err.cause = error
        this.addError(err)

        log.debug('Ajax error - fetching JMX tree:', text, '-', error)
      },
    }
    try {
      const domains = await (mbeanPaths.length > 0
        ? jolokiaService.sublist(mbeanPaths, options)
        : jolokiaService.list(options))
      log.debug('JMX tree loaded:', domains)

      // At this stage we have a JSON as it was sent by Jolokia (with the optimization applied)
      // so the `domains` is flat mapping of domains->mbeans->mbeanInfos.
      // Now it's time to create a proper tree using the key=value lists that are part of MBean names
      const tree = await MBeanTree.createFromDomains(pluginName, domains)

      // the newly created tree never includes the current UI state, so now (after the tree is created and
      // processed) we need to reapply it (expanded/collapsed state)
      const newExpandedFolders = new Set<string>()
      const newAllFolders = new Map<string, MBeanNode>()
      const newDomainFolders = new Map<string, Map<string, MBeanNode>>()
      this.applyUIState(tree.getTree(), newExpandedFolders, newAllFolders, newDomainFolders)
      this.expandedFolders = newExpandedFolders
      this.allFolders = newAllFolders
      this.domainFolders = newDomainFolders

      // when the tree is (re)loaded by the workspace during browser refresh, "nid" parameter
      // points to some MBean or a folder. Because workspace keeps the expanded/collapsed state
      // only for the folders, we need to do some final processing to expand relevant folders.
      // we had issues doing this in react effects in related components, so it's really better to do it here.
      // Hawtio hooks like `useMBeanTree()` will get simpler and more reliable.
      const x = new URLSearchParams(window.location.search)
      if (x.has('nid')) {
        const fromNid = tree.find(n => n.id === x.get('nid'))
        if (fromNid) {
          tree.forEach(fromNid.path(), n => {
            this.expand(true, n)
            if (n.children) {
              this.expandedFolders.add(n.id)
            }
          })
        }
      }

      this.maybeMonitorPlugins()
      this.maybeMonitorTree()

      return tree
    } catch (error) {
      const wkspError: Error = new Error('A request to list the JMX tree failed')
      wkspError.cause = error
      this.addError(wkspError)

      log.error(wkspError.message, error)
      return MBeanTree.createEmpty(pluginName)
    }
  }

  private async getConfig(): Promise<JmxConfig> {
    const { jmx } = await configManager.getHawtconfig()
    return jmx ?? {}
  }

  /**
   * If the Registry plugin is available then register
   * a callback to refresh the active app plugins in use.
   */
  private async maybeMonitorPlugins() {
    const hasPluginRegistry = await this.treeContainsDomainAndProperties('hawtio', { type: 'Registry' })

    if (hasPluginRegistry) {
      // no need to re-register the job if we already have one, assuming the MBean is still there
      if (!this.pluginRegisterHandle) {
        this.pluginRegisterHandle = jolokiaService.register(
          {
            type: 'read',
            mbean: HAWTIO_REGISTRY_MBEAN,
            attribute: 'UpdateCounter',
          },
          (response: JolokiaSuccessResponse | JolokiaErrorResponse | JolokiaFetchErrorResponse) =>
            this.maybeUpdatePlugins(response),
        )
      }
    } else {
      // the plugin registry MBean is not available (initially or after tree refresh), so if we had a job
      // for monitoring the registry, we have to unregister it
      if (this.pluginRegisterHandle) {
        const handle = await this.pluginRegisterHandle
        await jolokiaService.unregister(handle)
        this.pluginRegisterHandle = undefined
        this.pluginUpdateCounter = undefined
      }
    }
  }

  /**
   * If the TreeWatcher plugin is available then register
   * a callback to reload the tree in order to refresh
   * the changes.
   */
  private async maybeMonitorTree() {
    const hasTreeWatcher = await this.treeContainsDomainAndProperties('hawtio', { type: 'TreeWatcher' })

    if (hasTreeWatcher) {
      // no need to re-register the job if we already have one, assuming the MBean is still there
      if (!this.treeWatchRegisterHandle) {
        this.treeWatchRegisterHandle = jolokiaService.register(
          {
            type: 'read',
            mbean: HAWTIO_TREE_WATCHER_MBEAN,
            attribute: 'Counter',
          },
          (response: JolokiaSuccessResponse | JolokiaErrorResponse | JolokiaFetchErrorResponse) =>
            this.maybeReloadTree(response),
        )
      }
    } else {
      // the tree watcher MBean is not available (initially or after tree refresh), so if we had a job
      // for checking the watcher, we have to unregister it
      if (this.treeWatchRegisterHandle) {
        const handle = await this.treeWatchRegisterHandle
        jolokiaService.unregister(handle)
        this.treeWatchRegisterHandle = undefined
        this.treeWatcherCounter = undefined
      }
    }
  }

  /**
   * Based on the plugin registry change notification, we may reload entire app to pick up the newly available plugins
   * or remove the ones no longer available.
   * @param response
   * @private
   */
  private maybeUpdatePlugins(response: JolokiaSuccessResponse | JolokiaErrorResponse | JolokiaFetchErrorResponse) {
    if (Jolokia.isResponseFetchError(response)) {
      return
    }
    const counter = typeof response === 'object' && 'value' in response ? (response.value as number) : 0
    if (!this.pluginUpdateCounter) {
      // Initial counter setting
      this.pluginUpdateCounter = counter
      return
    }
    if (this.pluginUpdateCounter === counter) {
      return
    }

    // Refresh plugins by reloading page
    log.debug('Plugin update counter changed:', this.pluginUpdateCounter, '->', counter)
    if (jolokiaService.loadAutoRefresh()) {
      log.debug('Update plugins')
      window.location.reload()
    }
  }

  /**
   * Based on the tree watcher change notification, we may reload the JMX tree, so all the plugins that display
   * the tree re-render.
   * @param response
   * @private
   */
  private maybeReloadTree(response: JolokiaSuccessResponse | JolokiaErrorResponse | JolokiaFetchErrorResponse) {
    if (Jolokia.isResponseFetchError(response)) {
      return
    }
    const counter = typeof response === 'object' && 'value' in response ? (response.value as number) : 0
    if (!this.treeWatcherCounter) {
      // Initial counter setting
      this.treeWatcherCounter = counter
      return
    }
    if (this.treeWatcherCounter === counter) {
      return
    }
    // Refresh plugins by reloading page
    log.debug('Tree watcher counter changed:', this.treeWatcherCounter, '->', counter)
    this.treeWatcherCounter = counter as number
    log.debug('Refresh tree')
    this.refreshTree()
  }

  private applyUIState(
    nodes: MBeanNode[],
    expandedFolders: Set<string>,
    allFolders: Map<string, MBeanNode>,
    domainFolders: Map<string, Map<string, MBeanNode>>,
    currentDomain?: string,
  ) {
    for (const n of nodes) {
      if (n.children) {
        allFolders.set(n.id, n)
        if (!currentDomain) {
          domainFolders.set(n.name, new Map<string, MBeanNode>())
        } else {
          domainFolders.get(currentDomain)!.set(n.id, n)
        }
        if (this.expandedFolders.has(n.id)) {
          // don't expand parent folders by if child node is expanded, because when you expand
          // all and then collapse parent, on refresh it'll be expanded.
          expandedFolders.add(n.id)
        }
        this.applyUIState(n.children, expandedFolders, allFolders, domainFolders, currentDomain ?? n.name)
      }
    }
  }

  // ---- UI support methods for tree navigation

  expand(expanded: boolean, item: MBeanNode) {
    if (!item.children) {
      return
    }
    item.defaultExpanded = expanded
    if (expanded) {
      this.expandedFolders.add(item.id)
    } else {
      this.expandedFolders.delete(item.id)
    }
  }

  expandAll(expanded: boolean, domain?: string) {
    if (!domain) {
      if (expanded) {
        this.expandedFolders = new Set(this.allFolders.keys())
      } else {
        this.expandedFolders.clear()
      }
    } else {
      if (expanded) {
        this.expandedFolders = this.expandedFolders.union(new Set(this.domainFolders.get(domain)!.keys()))
        this.domainExpanded.set(domain, ExpansionValue.ExpandAll)
      } else {
        this.expandedFolders = this.expandedFolders.difference(new Set(this.domainFolders.get(domain)!.keys()))
        this.domainExpanded.set(domain, ExpansionValue.CollapseAll)
      }
    }
    ;(!domain ? this.allFolders : this.domainFolders.get(domain)!).values().forEach(folder => {
      folder.defaultExpanded = expanded
    })
  }

  clearExpandAll(domain: string): void {
    this.domainExpanded.set(domain, ExpansionValue.Default)
  }

  allExpanded(domain?: string): ExpansionValue {
    if (!domain) {
      if (this.expandedFolders.size === 0) {
        return ExpansionValue.CollapseAll
      }
      if (this.expandedFolders.size === this.allFolders.size) {
        return ExpansionValue.ExpandAll
      }
      return ExpansionValue.Default
    } else {
      const expanded = this.domainExpanded.get(domain)
      if (!expanded) {
        this.domainExpanded.set(domain, ExpansionValue.Default)
        return ExpansionValue.Default
      }
      return expanded
    }
  }

  // ---- methods to access and navigate already loaded and _stable_ JMX tree without changing it

  async hasMBeans(): Promise<boolean> {
    const tree = await this.getTree()
    return !tree.isEmpty()
  }

  private matchesProperties(node: MBeanNode, properties: Record<string, unknown>): boolean {
    if (!node) return false

    for (const [k, v] of Object.entries(properties)) {
      switch (k) {
        case 'id':
          if (!node.id.startsWith(v as string) && node.id !== v) return false
          break
        case 'name':
          if (node.name !== v) return false
          break
        case 'icon':
          if (JSON.stringify(node.icon) !== JSON.stringify(v)) return false
          break
      }
    }

    return true
  }

  async treeContainsDomainAndProperties(domainName: string, properties?: Record<string, unknown>): Promise<boolean> {
    const tree = await this.getTree()
    const domain = tree.get(domainName)
    if (!domain) {
      return false
    }

    if (properties) {
      const domainAndChildren: MBeanNode[] = [domain]
      domainAndChildren.push(...(domain.children ?? []))
      const checkProperties = (node: MBeanNode) => {
        if (!this.matchesProperties(node, properties)) {
          if (node.children && node.children.length > 0) {
            return node.children.some(checkProperties)
          } else {
            return false
          }
        } else {
          return true
        }
      }
      return domainAndChildren.some(checkProperties)
    }

    return true
  }

  /**
   * Finds MBeans in the workspace based on the domain name and properties.
   */
  async findMBeans(domainName: string, properties: Record<string, string>): Promise<MBeanNode[]> {
    const tree = await this.getTree()
    return tree.findMBeans(domainName, properties)
  }
}

export const workspace: IWorkspace = new Workspace()
