import { Logger } from '@hawtio/react/core'
import { escapeDots, escapeTags } from '@hawtio/react/util/jolokia'
import { isEmpty } from '@hawtio/react/util/objects'
import { stringSorter, trimQuotes } from '@hawtio/react/util/strings'
import { TreeViewDataItem } from '@patternfly/react-core'
import { CubeIcon, FolderIcon, FolderOpenIcon, LockIcon } from '@patternfly/react-icons'
import { IJmxMBean } from 'jolokia.js'
import React from 'react'
import { pluginName } from '../globals'

const log = Logger.get(`${pluginName}-tree`)

export const Icons = {
  folder: React.createElement(FolderIcon),
  folderOpen: React.createElement(FolderOpenIcon),
  mbean: React.createElement(CubeIcon),
  locked: React.createElement(LockIcon),
} as const

export type OptimisedJmxDomains = {
  [domainName: string]: OptimisedJmxDomain
}

export type OptimisedJmxDomain = {
  [propertyList: string]: OptimisedJmxMBean
}

export interface OptimisedJmxMBean extends IJmxMBean {
  opByString?: { [name: string]: unknown }
}

export interface FilterFunc {
  (node: MBeanNode): boolean
}

export interface ForEachFunc {
  (node: MBeanNode): void
}

export class MBeanNode implements TreeViewDataItem {
  id: string
  name: string
  icon: React.ReactNode
  expandedIcon?: React.ReactNode
  parent: MBeanNode | null
  children?: MBeanNode[]
  properties?: Record<string, string>

  // MBean info
  objectName?: string
  mbean?: OptimisedJmxMBean

  /**
   * A new node
   * @constructor
   * @param {MBeanNode|null} parent - The parent of the new node. Otherwise, for a singleton node use null.
   * @param {string} id - The unique identifier of the new node.
   * @param {string} name - The name of the new node.
   * @param {boolean} folder - Whether this new node is a folder, ie. has children
   */
  constructor(parent: MBeanNode | null, id: string, name: string, folder: boolean) {
    this.id = id
    this.name = name

    if (this === parent) throw Error('Node cannot be its own parent')

    this.parent = parent
    if (folder) {
      this.icon = Icons.folder
      this.expandedIcon = Icons.folderOpen
      this.children = []
    } else {
      this.icon = Icons.mbean
    }
  }

  populateMBean(propList: string, mbean: OptimisedJmxMBean) {
    log.debug('  JMX tree mbean:', propList)
    const props = new PropertyList(this, propList)
    this.createMBeanNode(props.getPaths(), props, mbean)
  }

  private createMBeanNode(paths: string[], props: PropertyList, mbean: OptimisedJmxMBean) {
    log.debug('    JMX tree property:', paths[0])
    if (paths.length === 1) {
      // final mbean node
      const mbeanNode = this.create(paths[0], false)
      mbeanNode.configureMBean(props, mbean)
      return
    }

    const path = paths.shift()
    if (path === undefined) {
      throw new Error('path should not be empty')
    }
    const child = this.getOrCreate(path, true)
    child.createMBeanNode(paths, props, mbean)
  }

  private configureMBean(propList: PropertyList, mbean: OptimisedJmxMBean) {
    this.objectName = propList.objectName()
    this.mbean = mbean

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

  get(name: string): MBeanNode | null {
    return this.children?.find(node => node.name === name) || null
  }

  getIndex(index: number): MBeanNode | null {
    return this.children ? this.children[index] : null
  }

  getChildren(): MBeanNode[] {
    return this.children ? this.children : []
  }

  matches(properties: Record<string, string>): boolean {
    const entries = properties ? Object.entries(properties) : []
    if (entries.length === 0) return false

    // Escape any regex special characters
    const escapeRegex = (str: string) => str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')

    let mCount = entries.length
    for (const [key, value] of entries) {
      /*
       * The * is used as the wildcard to remove it, escape the rest and rejoin
       * with the correct regex syntax
       */
      const rule = value.split('*').map(escapeRegex).join('.*')
      const re = new RegExp(`^${rule}$`, 'i')
      let nodeValue
      switch (key) {
        case 'name':
          nodeValue = this.name
          break
        default:
          nodeValue = this.getProperty(key)
          if (!nodeValue) return false // this node lacks this property
          break
      }

      if (nodeValue.match(re)) {
        mCount--
      } else {
        return false
      }
    }

    return mCount === 0
  }

  create(name: string, folder: boolean): MBeanNode {
    // this method should be invoked on a folder node
    if (this.children === undefined) {
      // re-init as folder
      this.icon = Icons.folder
      this.expandedIcon = Icons.folderOpen
      this.children = []
    }

    const id = escapeDots(name) + '-' + (this.children.length + 1)
    const newChild = new MBeanNode(this, id, name, folder)
    this.children.push(newChild)
    return newChild
  }

  getOrCreate(name: string, folder: boolean): MBeanNode {
    const node = this.get(name)
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

  childCount(): number {
    return this.children ? this.children.length : 0
  }

  getProperty(key: string): string {
    return this.properties ? this.properties[key] : ''
  }

  addProperty(key: string, value: string) {
    if (!this.properties) {
      this.properties = {}
    }

    this.properties[key] = value
  }

  sort(recursive: boolean) {
    if (!this.children) return

    this.children?.sort((a, b) => stringSorter(a.name, b.name))
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

  private getDescendentOrThis(pathEntry: string): MBeanNode | null {
    if (pathEntry === this.name || this.matches({ name: pathEntry })) return this

    return this.findDescendant(node => node.name === pathEntry || node.matches({ name: pathEntry })) || null
  }

  navigate(...namePath: string[]): MBeanNode | null {
    if (namePath.length === 0) return this // path is empty so return this node

    const child: MBeanNode | null = this.getDescendentOrThis(namePath[0])
    return !child ? null : child.navigate(...namePath.slice(1))
  }

  /**
   * Perform a function on each node in the given path
   * where the namePath drills down to descendants from
   * this node
   */
  forEach(namePath: string[], eachFn: ForEachFunc) {
    if (namePath.length === 0) return // path empty so nothing to do

    const child: MBeanNode | null = this.getDescendentOrThis(namePath[0])
    if (!child) return

    eachFn(child)
    child.forEach(namePath.slice(1), eachFn)
  }

  findDescendant(filter: FilterFunc): MBeanNode | null {
    if (filter(this)) {
      return this
    }

    let answer: MBeanNode | null = null
    if (this.children) {
      this.children.forEach(child => {
        if (!answer) {
          answer = child.findDescendant(filter)
        }
      })
    }
    return answer
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
  findAncestor(filter: FilterFunc): MBeanNode | null {
    let ancestor: MBeanNode | null = this.parent
    while (ancestor !== null) {
      if (filter(ancestor)) return ancestor

      ancestor = ancestor.parent
    }

    return null
  }

  filterClone(filter: FilterFunc): MBeanNode | null {
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

    const copy = new MBeanNode(this, this.id, this.name, copyChildren.length > 0)
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

    if (this === child) throw Error('Node cannot be its own child')

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
}

export class PropertyList {
  private domain: MBeanNode
  private propList: string
  private paths: { key: string; value: string }[] = []
  typeName?: string
  serviceName?: string

  private readonly propRegex = new RegExp(
    '(([^=,]+)=(\\\\"[^"]+\\\\"|\\\\\'[^\']+\\\\\'|"[^"]+"|\'[^\']+\'|[^,]+))|([^=,]+)',
    'g',
  )

  constructor(domain: MBeanNode, propList: string) {
    this.domain = domain
    this.propList = propList
    this.parse(propList)
  }

  private parse(propList: string) {
    const props: { [key: string]: string } = {}
    let match
    while ((match = this.propRegex.exec(propList))) {
      const [propKey, propValue] = this.parseProperty(match[0])
      props[propKey] = propValue
      let index = -1
      const lowerKey = propKey.toLowerCase()
      const path = { key: lowerKey, value: propValue }
      switch (lowerKey) {
        case 'type':
          this.typeName = propValue
          if (this.domain.get(propValue)) {
            // if the type name value already exists in the root node
            // of the domain then let's move this property around too
            index = 0
          } else if (props['name']) {
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
      objs.unshift(obj)
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
  return order.some((v, i) => v !== objs[i][objKey])
}
