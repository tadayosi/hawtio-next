import { Logger } from '@hawtiosrc/core'
import { escapeDots, escapeTags } from '@hawtiosrc/util/jolokia'
import { isEmpty } from '@hawtiosrc/util/objects'
import { stringSorter, trimQuotes } from '@hawtiosrc/util/strings'
import { TreeViewDataItem } from '@patternfly/react-core'
import { CubeIcon, FolderIcon, FolderOpenIcon, LockIcon } from '@patternfly/react-icons'
import { IJmxMBean } from 'jolokia.js'
import React from 'react'
import { pluginName } from '../globals'

const log = Logger.get(`${pluginName}-tree`)

const Icons = {
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

export class MBeanNode implements TreeViewDataItem {
  owner: string
  id: string
  name: string
  icon: React.ReactNode
  expandedIcon?: React.ReactNode
  children?: MBeanNode[]
  properties?: Record<string, string>

  // MBean info
  objectName?: string
  mbean?: OptimisedJmxMBean

  constructor(owner: string, id: string, name: string, folder: boolean) {
    this.id = id
    this.name = name
    if (folder) {
      this.icon = Icons.folder
      this.expandedIcon = Icons.folderOpen
      this.children = []
    } else {
      this.icon = Icons.mbean
    }

    this.owner = owner
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
      this.setIcons(Icons.locked)
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

  create(name: string, folder: boolean): MBeanNode {
    // this method should be invoked on a folder node
    if (this.children === undefined) {
      log.warn(`node "${this.name}" should be a folder`)
      // re-init as folder
      this.icon = Icons.folder
      this.expandedIcon = Icons.folderOpen
      this.children = []
    }

    const id = escapeDots(name) + '-' + (this.children.length + 1)
    const newChild = new MBeanNode(this.owner, id, name, folder)
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

  findDescendant(filter: (node: MBeanNode) => boolean): MBeanNode | null {
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

  filterClone(filter: (node: MBeanNode) => boolean): MBeanNode | null {
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

    const copy = new MBeanNode(this.owner, this.id, this.name, copyChildren.length > 0)
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
