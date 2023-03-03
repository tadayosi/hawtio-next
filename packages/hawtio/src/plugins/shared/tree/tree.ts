import { escapeDots, escapeTags } from '@hawtiosrc/util/jolokia'
import { stringSorter } from '@hawtiosrc/util/strings'
import { log } from './globals'
import { MBeanNode, OptimisedJmxDomain, OptimisedJmxDomains } from './node'
import { treeProcessorRegistry } from './processor-registry'

export class MBeanTree {
  private tree: MBeanNode[] = []

  static createEmpty(id: string): MBeanTree {
    return new MBeanTree(id)
  }

  static createFromDomains(id: string, domains: OptimisedJmxDomains): MBeanTree {
    const mBeanTree = new MBeanTree(id)
    mBeanTree.populate(domains)
    return mBeanTree
  }

  static createFromNodes(id: string, nodes: MBeanNode[]): MBeanTree {
    const mBeanTree = new MBeanTree(id)
    mBeanTree.tree = nodes
    return mBeanTree
  }

  static filter(originalTree: MBeanNode[], filter: (node: MBeanNode) => boolean): MBeanNode[] {
    const filteredTree: MBeanNode[] = []
    for (const node of originalTree) {
      const copy = node.filterClone(filter)
      if (copy) {
        filteredTree.push(copy)
      }
    }

    return filteredTree
  }

  private constructor(private id: string) {}

  private populate(domains: OptimisedJmxDomains) {
    Object.entries(domains).forEach(([name, domain]) => {
      // Domain name is displayed in the tree, so let's escape it here.
      // Use a custom escaping method here as escaping '"' breaks Camel tree.
      const escapedName = escapeTags(name)
      this.populateDomain(escapedName, domain)
    })

    this.sortTree()

    // Post-process loaded tree
    treeProcessorRegistry.process(this)

    log.debug('Populated JMX tree:', this.tree)
  }

  private populateDomain(name: string, domain: OptimisedJmxDomain) {
    log.debug('JMX tree domain:', name)
    const domainNode = this.getOrCreateNode(name)
    Object.entries(domain).forEach(([propList, mbean]) => {
      domainNode.populateMBean(propList, mbean)
    })
  }

  private getOrCreateNode(name: string): MBeanNode {
    const node = this.tree.find(node => node.name === name)
    if (node) {
      return node
    }

    const id = escapeDots(name)
    const newNode = new MBeanNode(this.id, id, name, true)
    this.tree.push(newNode)
    return newNode
  }

  private sortTree() {
    this.tree.sort((a, b) => stringSorter(a.name, b.name))
    this.tree.forEach(node => node.sort(true))
  }

  getTree(): MBeanNode[] {
    return this.tree
  }

  get(name: string): MBeanNode | null {
    const node = this.tree.find(node => {
      return node.name === name
    })

    return node ? node : null
  }

  isEmpty(): boolean {
    return this.tree.length === 0
  }

  /**
   * Searches this folder and all its descendants for the first folder to match the filter
   */
  findDescendant(filter: (node: MBeanNode) => boolean): MBeanNode | null {
    let answer: MBeanNode | null = null
    this.tree.forEach(child => {
      if (!answer) {
        answer = child.findDescendant(filter)
      }
    })
    return answer
  }

  /**
   * Flattens the tree of nested folder and MBean nodes into a map of object names and MBeans.
   */
  flatten(): Record<string, MBeanNode> {
    const mbeans: Record<string, MBeanNode> = {}
    this.tree.forEach(node => node.flatten(mbeans))
    return mbeans
  }
}
