import { escapeHtmlId, escapeTags } from '@hawtiosrc/util/htmls'
import { isEmpty } from '@hawtiosrc/util/objects'
import { matchWithWildcard, stringSorter, trimQuotes } from '@hawtiosrc/util/strings'
import { type TreeViewDataItem } from '@patternfly/react-core'
import { CubeIcon } from '@patternfly/react-icons/dist/esm/icons/cube-icon'
import { FolderIcon } from '@patternfly/react-icons/dist/esm/icons/folder-icon'
import { FolderOpenIcon } from '@patternfly/react-icons/dist/esm/icons/folder-open-icon'
import { LockIcon } from '@patternfly/react-icons/dist/esm/icons/lock-icon'
import { MBeanAttribute, MBeanInfo, MBeanInfoError, MBeanOperation } from 'jolokia.js'
import React from 'react'
import { array, define, is, nullable, object, optional, record, string, type, union } from 'superstruct'
import { log } from './globals'

export const Icons = {
  folder: React.createElement(FolderIcon),
  folderOpen: React.createElement(FolderOpenIcon),
  mbean: React.createElement(CubeIcon),
  locked: React.createElement(LockIcon),
} as const

export type OptimisedJmxDomains = Record<string, OptimisedJmxDomain>

export function isJmxDomains(value: unknown): value is OptimisedJmxDomains {
  return is(value, record(string(), define('JmxDomain', isJmxDomain)))
}

export type OptimisedJmxDomain = Record<string, OptimisedMBeanInfo>

export function isJmxDomain(value: unknown): value is OptimisedJmxDomain {
  const isMBeanInfoOrError = (value: unknown) => isMBeanInfo(value) || isMBeanInfoError(value)
  return is(value, record(string(), define('MBeanInfo', isMBeanInfoOrError)))
}

export interface OptimisedMBeanInfo extends Omit<MBeanInfo, 'attr' | 'op'> {
  attr?: Record<string, OptimisedMBeanAttribute>
  op?: OptimisedMBeanOperations
  opByString?: Record<string, OptimisedMBeanOperation>
  canInvoke?: boolean
}

export function isMBeanInfo(value: unknown): value is OptimisedMBeanInfo {
  return is(
    value,
    type({
      desc: optional(nullable(string())),
      class: optional(string()),
      attr: optional(record(string(), object())),
      op: optional(record(string(), union([object(), array(object())]))),
      notif: optional(record(string(), object())),
    }),
  )
}

export function isMBeanInfoError(value: unknown): value is MBeanInfoError {
  return is(value, type({ error: string() }))
}

export interface OptimisedMBeanAttribute extends MBeanAttribute {
  canInvoke?: boolean
  canRead?: boolean
  canWrite?: boolean
}

export type OptimisedMBeanOperations = Record<string, OptimisedMBeanOperation | OptimisedMBeanOperation[]>

export interface OptimisedMBeanOperation extends MBeanOperation {
  canInvoke?: boolean
}

export type MBeanNodeFilterFn = (node: MBeanNode) => boolean

export const MBEAN_NODE_ID_SEPARATOR = '-'

export class MBeanNode implements TreeViewDataItem {
  /**
   * ID of the tree view item in HTML.
   */
  id: string

  icon: React.ReactNode
  expandedIcon?: React.ReactNode
  children?: MBeanNode[]

  /**
   * Various metadata that can be attached to the node for processing it in the MBean tree.
   */
  private metadata: Record<string, string> = {}

  // MBean info
  objectName?: string
  mbean?: OptimisedMBeanInfo
  propertyList?: PropertyList

  // TreeViewDataItem properties
  defaultExpanded?: boolean

  /**
   * A new node
   * @constructor
   * @param {MBeanNode|null} parent - The parent of the new node. Otherwise, for a singleton node use null.
   * @param {string} name - The name of the new node.
   * @param {boolean} folder - Whether this new node is a folder, ie. has children
   */
  constructor(
    public parent: MBeanNode | null,
    readonly name: string,
    private readonly folder: boolean,
  ) {
    if (this === parent) throw new Error('Node cannot be its own parent')

    if (folder) {
      this.icon = Icons.folder
      this.expandedIcon = Icons.folderOpen
      this.children = []
    } else {
      this.icon = Icons.mbean
    }

    this.id = this.generateId(folder)
  }

  private idWithoutPostfix(): string {
    return this.children !== undefined ? this.id.replace(/-folder$/, '') : this.id
  }

  private generateId(folder: boolean): string {
    const idPrefix = this.parent ? this.parent.idWithoutPostfix() + MBEAN_NODE_ID_SEPARATOR : ''
    const idPostfix = folder ? '-folder' : ''
    let id = idPrefix + escapeHtmlId(this.name) + idPostfix

    // Check id is unique against current siblings
    if (this.parent) {
      this.parent.getChildren().forEach(child => {
        if (child === this) return

        // id could still end up the same as another
        // but pretty unlikely and not really worth doing more
        if (child.id === id) {
          id = id + '-' + Math.floor(Math.random() * 100)
        }
      })
    }

    return id
  }

  initId(recursive: boolean) {
    this.id = this.generateId(this.children !== undefined)
    if (recursive) {
      this.children?.forEach(c => c.initId(recursive))
    }
  }

  populateMBean(propList: string, mbean: OptimisedMBeanInfo) {
    log.debug('  JMX tree mbean:', propList)
    const props = new PropertyList(this, propList)
    this.createMBeanNode(props.getPaths(), props, mbean)
  }

  private createMBeanNode(paths: string[], props: PropertyList, mbean: OptimisedMBeanInfo) {
    log.debug('    JMX tree property:', paths[0])
    if (paths.length === 1) {
      // final mbean node
      const path = paths[0]
      if (!path) {
        log.error('Failed to process MBean. Malformed ObjectName:', `"${props.objectName()}"`)
        return
      }
      const mbeanNode = this.create(path, false)
      mbeanNode.configureMBean(props, mbean)
      return
    }

    const path = paths.shift()
    if (path === undefined) {
      log.error('Failed to process MBean. Malformed ObjectName:', `"${props.objectName()}"`)
      return
    }
    const child = this.getOrCreate(path, true)
    child.createMBeanNode(paths, props, mbean)
  }

  private configureMBean(propList: PropertyList, mbean: OptimisedMBeanInfo) {
    this.objectName = propList.objectName()
    this.mbean = mbean
    this.propertyList = propList

    // Also update icon based on canInvoke here
    this.applyCanInvoke()
  }

  private applyCanInvoke() {
    if (!this.mbean) {
      return
    }

    // Update icon to locked if it cannot be invoked
    if (this.mbean.canInvoke !== undefined && !this.mbean.canInvoke) {
      this.icon = Icons.locked
    }
  }

  /**
   * Copy the node to a new node with the given name, transferring the icons, children,
   * metadata, and MBean info.
   */
  copyTo(name: string): MBeanNode {
    const copy = new MBeanNode(null, name, this.folder)
    copy.icon = this.icon
    copy.expandedIcon = this.expandedIcon
    copy.children = this.children
    copy.metadata = this.metadata
    copy.objectName = this.objectName
    copy.mbean = this.mbean
    copy.propertyList = this.propertyList
    return copy
  }

  /**
   * Find children with the given name. There can be at most two nodes with the
   * same name, one as an MBean and the other as a folder.
   *
   * Think about the following case:
   * - MBean1: 'com.example:type=Example,name=App'
   * - MBean2: 'com.example:type=Example,name=App,sub=Part1'
   * - MBean3: 'com.example:type=Example,name=App,sub=Part2'
   * In this case, there can be two nodes with the same name 'App', one is MBean1,
   * and the other is the folder that contains MBean2 and MBean3.
   */
  findChildren(name: string): MBeanNode[] {
    return this.children?.filter(node => node.name === name) ?? []
  }

  /**
   * Return a child node with the given name or null. The 'folder' parameter is
   * required to identify a single node, as there can be at most two nodes with
   * the same name, one as an MBean and the other as a folder.
   *
   * See the JSDoc comment for the findChildren(name: string) method for more detail.
   */
  get(name: string, folder: boolean): MBeanNode | null {
    const candidates = this.findChildren(name)
    return candidates.find(node => node.folder === folder) ?? null
  }

  getIndex(index: number): MBeanNode | null {
    return this.children?.[index] ?? null
  }

  getChildren(): MBeanNode[] {
    return this.children ?? []
  }

  create(name: string, folder: boolean): MBeanNode {
    // this method should be invoked on a folder node
    if (this.children === undefined) {
      // re-init as folder
      this.icon = Icons.folder
      this.expandedIcon = Icons.folderOpen
      this.children = []
    }

    const newChild = new MBeanNode(this, name, folder)
    this.children.push(newChild)
    return newChild
  }

  getOrCreate(name: string, folder: boolean): MBeanNode {
    const node = this.get(name, folder)
    if (node) {
      return node
    }
    return this.create(name, folder)
  }

  removeChildren(): MBeanNode[] {
    if (!this.children) return []

    const remove: MBeanNode[] = this.children
    this.children = []

    for (const r of remove) {
      r.parent = null
    }

    return remove
  }

  removeChild(child: MBeanNode): MBeanNode | null {
    if (!this.children || !child) return null

    const index = this.children.indexOf(child)
    if (index === -1) return null

    const removed = this.children.splice(index, 1)[0] ?? null
    if (removed) {
      removed.parent = null
    }

    return removed
  }

  childCount(): number {
    return this.children ? this.children.length : 0
  }

  getType(): string | undefined {
    return this.getMetadata('type')
  }

  setType(type: string) {
    this.addMetadata('type', type)
  }

  getMetadata(key: string): string | undefined {
    return this.metadata[key]
  }

  addMetadata(key: string, value: string) {
    this.metadata[key] = value
  }

  getProperty(key: string): string | undefined {
    return this.propertyList?.get(key)
  }

  static sorter(a: MBeanNode, b: MBeanNode): number {
    const res = stringSorter(a.name, b.name)
    if (res !== 0) {
      return res
    }

    // folder precedes mbean node
    return Number(b.folder) - Number(a.folder)
  }

  sort(recursive: boolean) {
    if (!this.children) return

    this.children?.sort(MBeanNode.sorter)
    if (recursive) {
      this.children?.forEach(child => child.sort(recursive))
    }
  }

  path(): string[] {
    const path = [this.name]
    let p = this.parent
    while (p) {
      path.unshift(p.name)
      p = p.parent
    }

    return path
  }

  navigate(...namePath: string[]): MBeanNode | null {
    if (namePath.length === 0) return this // path is empty so return this node

    const name = namePath[0]
    if (!name) return null

    const child = this.findByNamePattern(name)
    return child?.navigate(...namePath.slice(1)) ?? null
  }

  /**
   * Perform a function on each node in the given path
   * where the namePath drills down to descendants from
   * this node
   */
  forEach(namePath: string[], eachFn: (node: MBeanNode) => void) {
    if (namePath.length === 0) return // path empty so nothing to do

    const name = namePath[0]
    if (!name) return

    const child = this.findByNamePattern(name)
    if (!child) return

    eachFn(child)
    child.forEach(namePath.slice(1), eachFn)
  }

  /**
   * Searches this node and all its descendants for the first node to match the filter.
   */
  find(filter: MBeanNodeFilterFn): MBeanNode | null {
    if (filter(this)) {
      return this
    }

    return this.children?.map(child => child.find(filter)).find(node => node !== null) ?? null
  }

  private findByNamePattern(name: string): MBeanNode | null {
    return this.find(node => matchWithWildcard(node.name, name))
  }

  /**
   * Finds MBeans in this node and all its descendants based on the properties.
   */
  findMBeans(properties: Record<string, string>): MBeanNode[] {
    const mbeans: MBeanNode[] = this.match(properties) ? [this] : []
    this.children?.forEach(child => mbeans.push(...child.findMBeans(properties)))
    return mbeans
  }

  /**
   * Matches the node with the given MBean properties.
   * Since only MBean node holds the properties, this method always returns false
   * when invoked on a folder node.
   */
  match(properties: Record<string, string>): boolean {
    return this.propertyList?.match(properties) ?? false
  }

  /**
   * Returns the chain of nodes forming the tree branch of ancestors
   * @method findAncestors
   * @for Node
   * @return {MBeanNode[]}
   */
  findAncestors(): MBeanNode[] {
    const chain: MBeanNode[] = []
    let ancestor: MBeanNode | null = this.parent
    while (ancestor !== null) {
      chain.unshift(ancestor)
      ancestor = ancestor.parent
    }

    return chain
  }

  /**
   * Returns the first node in the tree branch of ancestors that satisfies the given filter
   * @method findAncestor
   * @for Node
   * @return {MBeanNode}
   */
  findAncestor(filter: MBeanNodeFilterFn): MBeanNode | null {
    let ancestor: MBeanNode | null = this.parent
    while (ancestor !== null) {
      if (filter(ancestor)) return ancestor

      ancestor = ancestor.parent
    }

    return null
  }

  filterClone(filter: MBeanNodeFilterFn): MBeanNode | null {
    const copyChildren: MBeanNode[] = []
    if (this.children) {
      this.children.forEach(child => {
        const childCopy = child.filterClone(filter)
        if (childCopy) {
          copyChildren.push(childCopy)
        }
      })
    }

    if (copyChildren.length === 0 && !filter(this)) {
      //
      // this has no children and does not conform to filter
      //
      return null
    }

    const copy = new MBeanNode(this, this.name, copyChildren.length > 0)
    if (copyChildren.length > 0) {
      copy.children = copyChildren
    }
    copy.icon = this.icon
    copy.expandedIcon = this.expandedIcon
    return copy
  }

  adopt(child: MBeanNode) {
    if (!this.children) {
      this.children = []
    }

    if (this === child) throw new Error('Node cannot be its own child')

    if (child.parent) child.parent.removeChild(child)

    child.parent = this
    this.children.push(child)
  }

  /**
   * Recursive method to flatten MBeans.
   */
  flatten(mbeans: Record<string, MBeanNode>) {
    if (this.objectName) {
      mbeans[this.objectName] = this
    }
    this.children?.forEach(child => child.flatten(mbeans))
  }

  /**
   * Returns true if RBACDecorator has been already applied to this node at server side.
   * If the node doesn't have mbean or mbean.op, it always returns true.
   * https://github.com/hawtio/hawtio/blob/main/platforms/hawtio-osgi-jmx/src/main/java/io/hawt/osgi/jmx/RBACDecorator.java
   */
  isRBACDecorated(): boolean {
    if (!this.mbean || !this.mbean.op || isEmpty(this.mbean.op)) {
      return true
    }

    // RBACDecorator is considered as applied when mbean has both op and opByString fields
    return this.mbean.opByString !== undefined && !isEmpty(this.mbean.opByString)
  }

  updateCanInvoke(canInvoke: boolean) {
    if (!this.mbean) {
      return
    }

    this.mbean.canInvoke = canInvoke
    this.applyCanInvoke()
  }

  setIcons(icon: React.ReactNode, expandedIcon: React.ReactNode = icon) {
    this.icon = icon
    this.expandedIcon = expandedIcon
  }

  /**
   * Returns true only if all the given operations exist in this MBean node.
   */
  hasOperations(...names: string[]): boolean {
    if (!this.mbean || !this.mbean.op) {
      return false
    }

    const operations = this.mbean.op
    return names.every(name => operations[name] !== undefined)
  }

  /**
   * Returns true only if all the given methods can be invoked.
   */
  hasInvokeRights(...methods: string[]): boolean {
    const mbean = this.mbean
    if (!mbean) return true

    let canInvoke = mbean.canInvoke ?? true
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
    ops: OptimisedMBeanOperations,
    opsByString: Record<string, OptimisedMBeanOperation>,
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

  private resolveCanInvoke(op: OptimisedMBeanOperation | OptimisedMBeanOperation[]): boolean {
    // for single method
    if (!Array.isArray(op)) {
      return op.canInvoke ?? true
    }

    // for overloaded methods
    // returns true only if all overloaded methods can be invoked (i.e. canInvoke=true)
    const cantInvoke = op.find(o => o.canInvoke !== undefined && !o.canInvoke)
    return cantInvoke === undefined
  }
}

export class PropertyList {
  private properties: Record<string, string> = {}
  private paths: { key: string; value: string }[] = []
  // TODO: typeName needed?
  typeName?: string
  // TODO: serviceName needed?
  serviceName?: string

  private readonly propRegex = new RegExp(
    '(([^=,]+)=(\\\\"[^"]+\\\\"|\\\\\'[^\']+\\\\\'|"[^"]+"|\'[^\']+\'|[^,]+))|([^=,]+)',
    'g',
  )

  constructor(
    private domain: MBeanNode,
    private propList: string,
  ) {
    this.parse(propList)
  }

  private parse(propList: string) {
    let match
    while ((match = this.propRegex.exec(propList))) {
      const [propKey, propValue] = this.parseProperty(match[0])
      this.properties[propKey] = propValue
      let index = -1
      const lowerKey = propKey.toLowerCase()
      const path = { key: lowerKey, value: propValue }
      switch (lowerKey) {
        case 'type':
          this.typeName = propValue
          if (this.domain.findChildren(propValue).length > 0) {
            // if the type name value already exists in the root node
            // of the domain then let's move this property around too
            index = 0
          } else if (this.properties['name']) {
            // else if the name key already exists, insert the type key before it
            index = this.paths.findIndex(p => p.key === 'name')
          }
          break
        case 'service':
          this.serviceName = propValue
          break
      }
      if (index >= 0) {
        this.paths.splice(index, 0, path)
      } else {
        this.paths.push(path)
      }
    }

    this.maybeReorderPaths()
  }

  private parseProperty(property: string): [string, string] {
    let key = property
    let value = property
    // do not use split('=') as it splits wrong when there is a space in the mbean name
    const pos = property.indexOf('=')
    if (pos > 0) {
      key = property.substring(0, pos)
      value = property.substring(pos + 1)
    }
    // mbean property value is displayed in the tree, so let's escape it here
    value = escapeTags(trimQuotes(value || key))
    return [key, value]
  }

  /**
   * Reorders paths when they aren't in the correct order.
   */
  private maybeReorderPaths() {
    switch (this.domain.name) {
      case 'osgi.compendium':
        reorderObjects(this.paths, 'key', ['service', 'version', 'framework'])
        break
      case 'osgi.core':
        reorderObjects(this.paths, 'key', ['type', 'version', 'framework'])
        break
    }
  }

  get(key: string): string | undefined {
    return this.properties[key]
  }

  match(properties: Record<string, string>): boolean {
    return Object.entries(properties).every(([key, value]) => {
      const thisValue = this.properties[key]
      return thisValue && matchWithWildcard(thisValue, value)
    })
  }

  getPaths(): string[] {
    return this.paths.map(p => p.value)
  }

  objectName(): string {
    return `${this.domain.name}:${this.propList}`
  }
}

/**
 * Reorders objects by the given key according to the given order of values.
 */
function reorderObjects(objs: object[], key: string, order: string[]) {
  if (!checkReorderNeeded(objs, key, order)) {
    return
  }

  const objKey = key as keyof (typeof objs)[0]
  order.reverse().forEach(value => {
    const index = objs.findIndex(o => o[objKey] === value)
    if (index >= 0) {
      const obj = objs.splice(index, 1)[0]
      if (obj) {
        objs.unshift(obj)
      }
    }
  })
}

/**
 * Checks whether the given objects need to be reordered.
 */
function checkReorderNeeded(objs: object[], key: string, order: string[]): boolean {
  if (objs.length === 0 || order.length === 0) {
    return false
  }

  const objKey = key as keyof (typeof objs)[0]
  if (objs.length < order.length) {
    return objs.some((o, i) => o[objKey] !== order[i])
  }
  return order.some((v, i) => v !== objs[i]?.[objKey])
}
