import { eventService, Logger } from '@hawtio/react/core'
import { jolokiaService } from '__root__/connect/jolokia-service'
import { isString } from '@hawtio/react/util/strings'
import { IErrorResponse, IJmxOperation, IJmxOperations, IResponse, ISimpleOptions } from 'jolokia.js'
import { isArray } from '@hawtio/react/util/objects'
import { is, object } from 'superstruct'
import { HAWTIO_REGISTRY_MBEAN, HAWTIO_TREE_WATCHER_MBEAN, pluginName } from './globals'
import { MBeanNode, MBeanTree, OptimisedJmxDomain, OptimisedJmxDomains, OptimisedJmxMBean } from './tree'

const log = Logger.get(`${pluginName}-workspace`)

export type MBeanCache = { [propertyList: string]: string }

class Workspace {
  private tree: Promise<MBeanTree>
  private pluginRegisterHandle?: number
  private pluginUpdateCounter?: number
  private treeWatchRegisterHandle?: number
  private treeWatcherCounter?: number

  constructor() {
    this.tree = this.loadTree()
  }

  private async loadTree(): Promise<MBeanTree> {
    log.debug('Load JMX MBean tree')
    const options: ISimpleOptions = {
      ignoreErrors: true,
      error: (response: IErrorResponse) => {
        log.debug('Error fetching JMX tree:', response)
      },
      ajaxError: (xhr: JQueryXHR) => {
        log.debug('Error fetching JMX tree:', xhr)
      },
    }
    const value = await jolokiaService.list(options)

    const domains = this.unwindResponseWithRBACCache(value)
    log.debug('JMX tree loaded:', domains)

    const tree = MBeanTree.createFromDomains(pluginName, domains)

    this.maybeMonitorPlugins()
    this.maybeMonitorTree()

    return tree
  }

  refreshTree() {
    this.tree = new Promise(resolve => {
      this.loadTree().then(tree => {
        resolve(tree)
        eventService.refresh()
      })
    })
  }

  private maybeUpdatePlugins(response: IResponse): void {
    const counter = response.value
    if (!this.pluginUpdateCounter) {
      this.pluginUpdateCounter = counter as number
      return
    }
    if (this.pluginUpdateCounter !== response.value) {
      if (jolokiaService.loadAutoRefresh()) {
        window.location.reload()
      }
    }
  }

  private maybeReloadTree(response: IResponse): void {
    const counter = response.value
    if (!this.treeWatcherCounter) {
      this.treeWatcherCounter = counter as number
      return
    }
    if (this.treeWatcherCounter !== counter) {
      this.treeWatcherCounter = counter as number
      this.refreshTree()
    }
  }

  /**
   * If the Registry plugin is available then register
   * a callback to refresh the active app plugins in use
   */
  private async maybeMonitorPlugins() {
    const hasRegistry = await this.treeContainsDomainAndProperties('hawtio', { type: 'Registry' })

    if (hasRegistry) {
      if (!this.pluginRegisterHandle) {
        this.pluginRegisterHandle = await jolokiaService.register(
          {
            type: 'read',
            mbean: HAWTIO_REGISTRY_MBEAN,
            attribute: 'UpdateCounter',
          },
          (response: IResponse) => this.maybeUpdatePlugins(response),
        )
      }
    } else {
      if (this.pluginRegisterHandle) {
        jolokiaService.unregister(this.pluginRegisterHandle)
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
      if (!this.treeWatchRegisterHandle) {
        this.treeWatchRegisterHandle = await jolokiaService.register(
          {
            type: 'read',
            mbean: HAWTIO_TREE_WATCHER_MBEAN,
            attribute: 'Counter',
          },
          (response: IResponse) => this.maybeReloadTree(response),
        )
      }
    } else {
      if (this.treeWatchRegisterHandle) {
        jolokiaService.unregister(this.treeWatchRegisterHandle)
        this.treeWatchRegisterHandle = undefined
        this.treeWatcherCounter = undefined
      }
    }
  }

  /**
   * Processes response from Jolokia LIST - if it contains "domains" and "cache"
   * properties.
   *
   * @param value response value from Jolokia
   */
  private unwindResponseWithRBACCache(value: unknown): OptimisedJmxDomains {
    if (is(value, object({ domains: object(), cache: object() }))) {
      // post process cached RBAC info
      for (const domainName in value.domains) {
        const domain = value.domains[domainName] as OptimisedJmxDomain | MBeanCache
        for (const mbeanName in domain) {
          const mbeanOrCache = domain[mbeanName]
          if (isString(mbeanOrCache)) {
            domain[mbeanName] = value.cache[mbeanOrCache] as OptimisedJmxMBean
          }
        }
      }
      return value.domains as OptimisedJmxDomains
    }
    return value as OptimisedJmxDomains
  }

  async getTree(): Promise<MBeanTree> {
    return this.tree
  }

  /**
   * Returns true if this workspace has any MBeans at all.
   */
  async hasMBeans(): Promise<boolean> {
    return !(await this.tree).isEmpty()
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
    const tree = await this.tree
    if (!tree) {
      return false
    }

    const domain = tree.get(domainName)
    if (!domain) {
      return false
    }

    if (properties) {
      const domainAndChildren: MBeanNode[] = [domain]
      domainAndChildren.push(...(domain.children || []))
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

  parseMBean(mbean: string) {
    const answer: { domain: string; attributes: Record<string, string> } = {
      domain: '',
      attributes: {},
    }
    let parts: string[] = mbean.split(':')
    if (parts.length > 1) {
      answer.domain = parts[0]
      parts = parts.filter((v: string) => v !== answer.domain)
      const parts2 = parts.join(':')
      answer.attributes = {}
      const nameValues = parts2.split(',')
      nameValues.forEach((p: string) => {
        let nameValue = p.split('=')
        const name = nameValue[0].trim()
        nameValue = nameValue.filter((v: string) => v !== name)
        answer.attributes[name] = nameValue.join('=').trim()
      })
    }
    return answer
  }

  hasInvokeRights(node: MBeanNode, ...methods: string[]): boolean {
    if (!node) return true

    const mbean = node.mbean
    if (!mbean) return true

    let canInvoke = true
    if (mbean.canInvoke !== undefined) canInvoke = mbean.canInvoke

    if (canInvoke && methods && methods.length > 0) {
      const opsByString = mbean.opByString
      const ops = mbean.op
      if (opsByString && ops) {
        canInvoke = this.resolveCanInvokeInOps(ops, opsByString, methods)
      }
    }
    return canInvoke
  }

  /**
   * Returns true only if all relevant operations can be invoked.
   */
  private resolveCanInvokeInOps(
    ops: IJmxOperations,
    opsByString: { [name: string]: unknown },
    methods: string[],
  ): boolean {
    let canInvoke = true
    methods.forEach(method => {
      if (!canInvoke) {
        return
      }
      let op = null
      if (method.endsWith(')')) {
        op = opsByString[method]
      } else {
        op = ops[method]
      }
      if (!op) {
        log.debug('Could not find method:', method, 'to check permissions, skipping')
        return
      }
      canInvoke = this.resolveCanInvoke(op)
    })
    return canInvoke
  }

  private resolveCanInvoke(op: unknown): boolean {
    // for single method
    if (!isArray(op)) {
      const operation = op as IJmxOperation
      return operation.canInvoke !== undefined ? operation.canInvoke : true
    }

    const operation = op as IJmxOperation[]

    // for overloaded methods
    // returns true only if all overloaded methods can be invoked (i.e. canInvoke=true)
    const cantInvoke = operation.find((o: IJmxOperation) => o.canInvoke !== undefined && !o.canInvoke)
    return cantInvoke === undefined
  }
}

export const workspace = new Workspace()
