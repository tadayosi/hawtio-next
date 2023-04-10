import { MBeanNode, workspace } from '__root__/shared'
import { isObject } from '@hawtio/react/util/objects'
import { jolokiaService } from '__root__/connect/jolokia-service'
import {
  componentNodeType,
  componentsType,
  contextNodeType,
  contextsType,
  domainNodeType,
  endpointNodeType,
  endpointsType,
  jmxDomain,
  mbeansType,
  routeNodeType,
  routesType,
  routeXmlNodeType,
} from './globals'

export function setChildProperties(parent: MBeanNode | null, childType: string) {
  if (!parent) return

  for (const child of parent.getChildren()) {
    setType(child, childType)
    setDomain(child)
    setChildProperties(child, childType)
  }
}

export function setType(node: MBeanNode, type: string) {
  node.addProperty('type', type)
}

export function setDomain(node: MBeanNode) {
  node.addProperty('domain', jmxDomain)
}

export function hasDomain(node: MBeanNode): boolean {
  return node && jmxDomain === node.getProperty('domain')
}

export function hasMBean(node: MBeanNode): boolean {
  return node && node.objectName !== undefined && isObject(node.mbean)
}

export function hasType(node: MBeanNode, type: string): boolean {
  return node && type === node.getProperty('type')
}

export function isDomainNode(node: MBeanNode): boolean {
  return node && hasType(node, domainNodeType)
}

export function isContextsFolder(node: MBeanNode): boolean {
  return node && hasDomain(node) && hasType(node, contextsType)
}

export function isContext(node: MBeanNode): boolean {
  return node && hasDomain(node) && hasType(node, contextNodeType)
}

export function findContext(node: MBeanNode): MBeanNode | null {
  if (!node || !hasDomain(node)) return null

  if (isDomainNode(node)) {
    // The camel domain node
    return node.getIndex(0)
  }

  if (isContextsFolder(node)) {
    if (node.childCount() === 0) return null

    /* Find first context node in the list */
    return node.getIndex(0)
  }

  if (isContext(node)) {
    return node
  } else {
    /* Node is below a context so navigate up the tree */
    return node.findAncestor((ancestor: MBeanNode) => isContext(ancestor))
  }
}

export function isRoutesFolder(node: MBeanNode): boolean {
  return node && hasDomain(node) && !hasMBean(node) && hasType(node, routesType)
}

export function isRouteNode(node: MBeanNode): boolean {
  return node && hasDomain(node) && hasType(node, routeNodeType)
}

export function isRouteXmlNode(node: MBeanNode): boolean {
  return node && hasDomain(node) && hasType(node, routeXmlNodeType)
}

export function isEndpointsFolder(node: MBeanNode): boolean {
  return node && hasDomain(node) && !hasMBean(node) && hasType(node, endpointsType)
}

export function isEndpointNode(node: MBeanNode): boolean {
  return node && hasDomain(node) && hasType(node, endpointNodeType)
}

export function isComponentsFolder(node: MBeanNode): boolean {
  return node && hasDomain(node) && !hasMBean(node) && hasType(node, componentsType)
}

export function isComponentNode(node: MBeanNode): boolean {
  return node && hasDomain(node) && hasType(node, componentNodeType)
}

export function findInflightRepository(node: MBeanNode): MBeanNode | null {
  if (!node) return null

  const ctxNode = findContext(node)
  if (!ctxNode) return null

  const result = ctxNode.navigate(mbeansType, 'services')
  if (!result || !result.children) return null

  const inFlightRepo = result.getChildren().find(m => m.name.startsWith('DefaultInflightRepository'))
  return !inFlightRepo ? null : inFlightRepo
}

export function hasInflightRepository(node: MBeanNode): boolean {
  return findInflightRepository(node) !== null
}

export function canBrowse(node: MBeanNode): boolean {
  const inflightNode = findInflightRepository(node)
  if (!inflightNode) return false

  return workspace.hasInvokeRights(inflightNode as MBeanNode, 'browse')
}

export function hasExchange(node: MBeanNode): boolean {
  return (
    node &&
    !isEndpointsFolder(node) &&
    !isEndpointNode(node) &&
    !isComponentsFolder(node) &&
    !isComponentNode(node) &&
    (isContext(node) || isRoutesFolder(node) || isRouteNode(node)) &&
    isCamelVersionEQGT_2_15(node) &&
    hasInflightRepository(node)
  )
}

export function findTypeConverter(node: MBeanNode): MBeanNode | null {
  if (!node) return null

  const ctxNode = findContext(node)
  if (!ctxNode) return null

  const result = ctxNode.navigate(mbeansType, 'services')
  if (!result || !result.children) return null

  const typeConvertor = result.getChildren().find(m => m.name.endsWith('TypeConverter'))
  return !typeConvertor ? null : typeConvertor
}

export function canListTypeConverters(node: MBeanNode): boolean {
  const tc = findTypeConverter(node)
  if (!tc) return false

  return workspace.hasInvokeRights(tc as MBeanNode, 'listTypeConverters')
}

export function hasTypeConverter(node: MBeanNode): boolean {
  return (
    node &&
    !isRouteNode(node) &&
    !isRouteXmlNode(node) &&
    !isEndpointsFolder(node) &&
    !isEndpointNode(node) &&
    !isComponentsFolder(node) &&
    !isComponentNode(node) &&
    (isContext(node) || isRoutesFolder(node)) &&
    isCamelVersionEQGT_2_13(node) &&
    canListTypeConverters(node)
  )
}

/**
 * Fetch the camel version and add it to the tree to avoid making a blocking call
 * elsewhere.
 */
export async function setCamelVersion(contextNode: MBeanNode | null) {
  if (!contextNode) return

  const v = contextNode.getProperty('version')
  if (v && v.length !== 0)
    /* Already retrieved */
    return

  if (!contextNode.objectName) {
    contextNode.addProperty('version', 'Camel Version not available')
    return
  }

  const camelVersion = await jolokiaService.readAttribute(contextNode.objectName, 'CamelVersion')
  contextNode.addProperty('version', camelVersion as string)
}

export function getCamelVersion(node: MBeanNode | null): string {
  const ctxNode = findContext(node as MBeanNode)
  if (!ctxNode) return ''

  return ctxNode.getProperty('version')
}

export function compareVersions(version: string, major: number, minor: number): number {
  const arr = version.split('.')

  // parse int or default to 0
  const vmaj = parseInt(arr[0]) || 0
  const vmin = parseInt(arr[1]) || 0
  if (vmaj < major) return -1

  if (vmaj > major) return 1

  // maj == major
  if (vmin < minor) return -1

  if (vmin > minor) return 1

  // major and minor are the same
  return 0
}

/**
 * Is the currently selected Camel version equal or greater than
 *
 * @param major   major version as number
 * @param minor   minor version as number
 */
export function isCamelVersionEQGT(node: MBeanNode, major: number, minor: number) {
  const camelVersion = getCamelVersion(node)
  if (camelVersion) {
    return compareVersions(camelVersion, major, minor) >= 0
  }

  return false
}

export function isCamelVersionEQGT_2_13(node: MBeanNode) {
  return isCamelVersionEQGT(node, 2, 13)
}
export function isCamelVersionEQGT_2_14(node: MBeanNode) {
  return isCamelVersionEQGT(node, 2, 14)
}
export function isCamelVersionEQGT_2_15(node: MBeanNode) {
  return isCamelVersionEQGT(node, 2, 15)
}
export function isCamelVersionEQGT_2_16(node: MBeanNode) {
  return isCamelVersionEQGT(node, 2, 16)
}
