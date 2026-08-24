import { matchWithWildcard } from '@hawtiosrc/util/strings'
import { log } from '../globals'
import { MBeanNode, type MBeanNodeFilterFn, OptimisedJmxDomain, OptimisedJmxDomains } from './node'
import { treeProcessorRegistry } from './processor-registry'

/**
 * The object representation of MBean tree.
 * Internally, it is constructed of MBeanNode[].
 *
 * Even if the tree could be represented by a single MBeanNode without any parent, it's
 * better to have one _entry point_ of the tree with dedicated operations.
 */
export class MBeanTree {
  // In a tree that represents all the MBeans from server-side Java, each MBeanNode at this level always represents
  // a JMX domain, is a folder (even without children) and does not have an objectName.
  // When a tree is constructed to represent other structures, a node may be anything and care should be
  // taken to not think about MBeanNode representing actual MBean (it may be a group folder or similar)
  private tree: MBeanNode[] = []

  // ---- static tree construction methods

  /**
   * Create an empty tree - useful for initialization or when the tree is constructed by tree processors
   * or other code
   * @param id
   */
  static createEmpty(id: string): MBeanTree {
    return new MBeanTree(id)
  }

  /**
   * The "main" tree creation method based on the result of Jolokia `list` operation.
   * The is the most complex creation method where domain->mbean hierarchy is transformed
   * into a dynamic tree where nesting is based on `key=value` items of MBeans' ObjectNames.
   * @param id
   * @param domains
   */
  static async createFromDomains(id: string, domains: OptimisedJmxDomains): Promise<MBeanTree> {
    const mBeanTree = new MBeanTree(id)
    await mBeanTree.populate(domains)
    return mBeanTree
  }

  /**
   * Create a new tree based on existing nodes
   * @param id
   * @param nodes
   */
  static createFromNodes(id: string, nodes: MBeanNode[]): MBeanTree {
    const mBeanTree = new MBeanTree(id)
    mBeanTree.tree = nodes
    return mBeanTree
  }

  /**
   * Static filtering method to pick matching nodes from the passed tree (not from `this.tree`).
   * @param originalTree
   * @param filter
   */
  static filter(originalTree: MBeanNode[], filter: MBeanNodeFilterFn): MBeanNode[] {
    // Filter behaviour is the following:
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
          const parentNodeCloned = Object.assign(Object.create(Object.getPrototypeOf(parentNode)), parentNode)
          parentNodeCloned.children = resultsInSubtree

          results = results.concat(parentNodeCloned)
        }
      }
    }

    return results
  }

  /**
   * Private constructor, so all creation happens via static methods. We may find
   * some usage for the `id` parameter at some point...
   * @param id
   * @private
   */
  private constructor(private id: string) {}

  /**
   * Change a 2-level tree of JMX domains and MBeans into a more dynamic tree with more
   * nested levels depending on the MBean properties (key/values). The tree is also processed
   * using available tree processors
   * @param domains
   * @private
   */
  private async populate(domains: OptimisedJmxDomains) {
    Object.entries(domains).forEach(([name, domain]) => {
      this.populateDomain(name, domain)
    })

    this.sortTree()

    // Post-process loaded tree
    await treeProcessorRegistry.process(this)

    log.debug('Populated JMX tree:', this.tree)
  }

  /**
   * Each JMX domain contains a flat list of MBeans, where each MBean _name_ is a list of `key=value` pairs. The more
   * such pairs, the more nested the result tree will be.
   * @param name
   * @param domain
   * @private
   */
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

  // ---- tree access methods that don't change its content or structure

  /**
   * Returns all the top-level nodes of the tree,
   * usually JMX domains if the tree was populated from Jolokia `list`
   */
  getTree(): MBeanNode[] {
    return this.tree
  }

  /**
   * Returns matching top-level node by name. At the tree level it's usually a JMX domain.
   * @param name
   */
  get(name: string): MBeanNode | null {
    return this.tree.find(node => node.name === name) ?? null
  }

  /**
   * Is the tree empty?
   */
  isEmpty(): boolean {
    return this.tree.length === 0
  }

  /**
   * Searches the entire tree for the first MBean node to match the filter.
   * The search is performed as DFS and doesn't distinguish between MBeanNodes whether these
   * are for domains, are folders or represent actual MBean. It's up to the `MBeanNodeFilterFn` to decide.
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

  /**
   * Similar to "find by name", but uses a path to match nested nodes in children order.
   * Return the target node if found or null otherwise.
   * @param namePath
   */
  navigate(...namePath: string[]): MBeanNode | null {
    if (namePath.length === 0 || !namePath[0]) {
      // path is empty or first segment is empty so return nothing
      return null
    }

    const name = namePath[0]

    // navigation should be performed strictly level by level without skipping
    const child = this.tree.find(n => matchWithWildcard(n.name, name))
    return child?.navigate(...namePath.slice(1)) ?? null
  }

  /**
   * Perform a function on each node in the given path
   * where the namePath drills down to descendants of this tree
   */
  forEach(namePath: string[], eachFn: (node: MBeanNode) => void) {
    if (namePath.length === 0 || !namePath[0]) {
      // path is empty or first segment is empty so nothing to do
      return
    }

    const name = namePath[0]

    const child = this.tree.find(n => matchWithWildcard(n.name, name))
    if (!child) {
      return
    }

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
