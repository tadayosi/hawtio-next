import { Logger } from '@hawtiosrc/core'
import { jolokiaService } from '@hawtiosrc/plugins/connect/jolokia-service'
import { isString } from '@hawtiosrc/util/strings'
import { IErrorResponse, ISimpleOptions } from 'jolokia.js'
import { is, object } from 'superstruct'
import { pluginName } from './globals'
import { MBeanNode, MBeanTree, OptimisedJmxDomain, OptimisedJmxDomains, OptimisedJmxMBean } from './tree'

const log = Logger.get(`${pluginName}-workspace`)

export type MBeanCache = { [propertyList: string]: string }

class Workspace {
  private tree: Promise<MBeanTree>

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

    // TODO: this.jolokiaStatus.xhr = null
    const domains = this.unwindResponseWithRBACCache(value)
    log.debug('JMX tree loaded:', domains)
    return MBeanTree.createFromDomains(pluginName, domains)
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
}

export const workspace = new Workspace()
