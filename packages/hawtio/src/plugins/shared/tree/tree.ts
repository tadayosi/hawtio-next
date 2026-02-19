import { matchWithWildcard } from '@hawtiosrc/util/strings'
import { log } from '../globals'
import { MBeanNode, MBeanNodeFilterFn, OptimisedJmxDomain, OptimisedJmxDomains } from './node'
import { treeProcessorRegistry } from './processor-registry'

/**
 * The object representation of MBean tree.
 * Internally, it is constructed of MBeanNode[].
 */
export class MBeanTree {
  private tree: MBeanNode[] = []

  static createEmpty(id: string): MBeanTree {
    return new MBeanTree(id)
  }

  static async createFromDomains(id: string, domains: OptimisedJmxDomains): Promise<MBeanTree> {
    const mBeanTree = new MBeanTree(id)
    await mBeanTree.populate(domains)
    return mBeanTree
  }

  static createFromNodes(id: string, nodes: MBeanNode[]): MBeanTree {
    const mBeanTree = new MBeanTree(id)
    mBeanTree.tree = nodes
    return mBeanTree
  }

  static filter(originalTree: MBeanNode[], filter: MBeanNodeFilterFn): MBeanNode[] {
    //Filter behaviour is the following:
    // 1) If there is a hit in a parent bean, bring everything under the parent
    // 2) If there is no hit in the parent, but there is in a sub bean
    //    2.1) Bring beans from the hit to the highest parent
    //    2.2) Bring beans in the hit and all sub beans
    // 3) Else, it wont return anything.

    if (!originalTree || originalTree?.length === 0) return []

    let results: MBeanNode[] = []

    for (const parentNode of originalTree) {
      if (filter(parentNode)) {
        results = results.concat(parentNode)
      } else {
        const resultsInSubtree = MBeanTree.filter(parentNode.children || [], filter)

        if (resultsInSubtree.length !== 0) {
          const parentNodeCloned = Object.assign({}, parentNode)
          parentNodeCloned.children = resultsInSubtree

          results = results.concat(parentNodeCloned)
        }
      }
    }

    return results
  }

  private constructor(private id: string) {}

  private async populate(domains: OptimisedJmxDomains) {
    Object.entries(domains).forEach(([name, domain]) => {
      this.populateDomain(name, domain)
    })

    this.sortTree()

    // Post-process loaded tree
    await treeProcessorRegistry.process(this)

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

    const newNode = new MBeanNode(null, name, true)
    this.tree.push(newNode)
    return newNode
  }

  private sortTree() {
    this.tree.sort(MBeanNode.sorter)
    this.tree.forEach(node => node.sort(true))
  }

  getTree(): MBeanNode[] {
    return this.tree
  }

  get(name: string): MBeanNode | null {
    return this.tree.find(node => node.name === name) ?? null
  }

  isEmpty(): boolean {
    return this.tree.length === 0
  }

  /**
   * Searches the entire tree for the first MBean node to match the filter.
   */
  find(filter: MBeanNodeFilterFn): MBeanNode | null {
    return this.tree.map(domain => domain.find(filter)).find(node => node !== null) ?? null
  }

  /**
   * Finds MBeans in the tree based on the domain name and properties.
   */
  findMBeans(domainName: string, properties: Record<string, string>): MBeanNode[] {
    return this.get(domainName)?.findMBeans(properties) ?? []
  }

  private descendByPathEntry(pathEntry: string): MBeanNode | null {
    return this.find(node => matchWithWildcard(node.name, pathEntry))
  }

  navigate(...namePath: string[]): MBeanNode | null {
    if (namePath.length === 0) return null // path is empty so return nothing

    const name = namePath[0]
    if (!name) return null

    const child = this.descendByPathEntry(name)
    return child?.navigate(...namePath.slice(1)) ?? null
  }

  /**
   * Perform a function on each node in the given path
   * where the namePath drills down to descendants of this tree
   */
  forEach(namePath: string[], eachFn: (node: MBeanNode) => void) {
    if (namePath.length === 0) return // path empty so nothing to do

    const name = namePath[0]
    if (!name) return

    const child = this.descendByPathEntry(name)
    if (!child) return

    eachFn(child)
    child.forEach(namePath.slice(1), eachFn)
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
