import { eventService } from '@hawtiosrc/core'
import { MBeanNode } from '@hawtiosrc/plugins/shared'
import { jolokiaService } from '@hawtiosrc/plugins/shared/jolokia-service'
import { isObject } from '@hawtiosrc/util/objects'
import { isBlank } from '@hawtiosrc/util/strings'
import { ENDPOINT_OPERATIONS } from './endpoints/endpoints-service'
import {
  componentNodeType,
  componentsType,
  contextNodeType,
  contextsType,
  domainNodeType,
  endpointNodeType,
  endpointsType,
  jmxDomain,
  log,
  mbeansType,
  routeNodeType,
  routeXmlNodeType,
  routesType,
} from './globals'
import { ROUTE_OPERATIONS } from './route-stats-service'

// TODO: Should be provided by @hawtio/camel-model package
export type CamelModel = {
  apacheCamelModelVersion: string
  components: { [name: string]: CamelModelSchema }
  dataformats: { [name: string]: CamelModelSchema }
  definitions: { [name: string]: CamelModelSchema }
  languages: { [name: string]: CamelModelSchema }
  rests: { [name: string]: CamelModelSchema }
}

export type CamelModelSchema = {
  type: string
  title: string
  group: string
  icon: string
  description: string
  acceptInput?: string
  acceptOutput?: string
  nextSiblingAddedAsChild?: boolean
  properties: { [name: string]: CamelModelProperty }
}

export type CamelModelProperty = {
  kind: string
  type: string
  defaultValue?: string
  enum?: string[]
  description: string
  title: string
  required: boolean
  deprecated: boolean
}

export function notifyError(msg: string) {
  eventService.notify({
    type: 'danger',
    message: msg,
  })
}

export function notifyInfo(msg: string) {
  eventService.notify({
    type: 'info',
    message: msg,
  })
}

export function setChildProperties(parent: MBeanNode | null, childType: string) {
  if (!parent) return

  for (const child of parent.getChildren()) {
    child.setType(childType)
    setDomain(child)
    setChildProperties(child, childType)
  }
}

export function setDomain(node: MBeanNode) {
  node.addMetadata('domain', jmxDomain)
}

export function hasDomain(node: MBeanNode): boolean {
  return jmxDomain === node.getMetadata('domain')
}

export function hasMBean(node: MBeanNode): boolean {
  return node.objectName !== undefined && isObject(node.mbean)
}

export function isDomainNode(node: MBeanNode): boolean {
  return node.getType() === domainNodeType
}

export function isContextsFolder(node: MBeanNode): boolean {
  return hasDomain(node) && node.getType() === contextsType
}

export function isContext(node: MBeanNode): boolean {
  return hasDomain(node) && node.getType() === contextNodeType
}

export function findContext(node: MBeanNode): MBeanNode | null {
  if (!hasDomain(node)) return null

  if (isDomainNode(node)) {
    // The camel domain node so traverse to context folder & recurse
    return findContext(node.getIndex(0) as MBeanNode)
  }

  if (isContextsFolder(node)) {
    if (node.childCount() === 0) return null

    // Find first context node in the list
    return node.getIndex(0)
  }

  if (isContext(node)) {
    return node
  }

  // Node is below a context so navigate up the tree
  return node.findAncestor(ancestor => isContext(ancestor))
}

export function isRoutesFolder(node: MBeanNode): boolean {
  return hasDomain(node) && !hasMBean(node) && node.getType() === routesType
}

export function isRouteNode(node: MBeanNode): boolean {
  return hasDomain(node) && node.getType() === routeNodeType
}

export function isRouteXmlNode(node: MBeanNode): boolean {
  return hasDomain(node) && node.getType() === routeXmlNodeType
}

export function isEndpointsFolder(node: MBeanNode): boolean {
  return hasDomain(node) && !hasMBean(node) && node.getType() === endpointsType
}

export function isEndpointNode(node: MBeanNode): boolean {
  return hasDomain(node) && node.getType() === endpointNodeType
}

export function isComponentsFolder(node: MBeanNode): boolean {
  return hasDomain(node) && !hasMBean(node) && node.getType() === componentsType
}

export function isComponentNode(node: MBeanNode): boolean {
  return hasDomain(node) && node.getType() === componentNodeType
}

export function isBasicMBeanNode(node: MBeanNode): boolean {
  return hasMBean(node) && !isContextsFolder(node) && !isRoutesFolder(node) && !isRouteXmlNode(node)
}

function findMBean(node: MBeanNode, folder: string, id: string): MBeanNode | null {
  if (!node) return null

  const ctxNode = findContext(node)
  if (!ctxNode) return null

  const result = ctxNode.navigate(mbeansType, folder)
  if (!result || !result.children) return null

  const service = result.getChildren().find(m => m.name.startsWith(id))
  return !service ? null : service
}

export function hasInflightRepository(node: MBeanNode): boolean {
  return findMBean(node, 'services', 'DefaultInflightRepository') !== null
}

export function canViewRouteDiagram(node: MBeanNode): boolean {
  return isRouteNode(node) || isRoutesFolder(node)
}

export function canViewSource(node: MBeanNode): boolean {
  if (isEndpointNode(node) || isEndpointsFolder(node)) return false
  if (!isRouteNode(node) && !isRoutesFolder(node)) return false

  const context = findContext(node)
  return context?.hasInvokeRights(ROUTE_OPERATIONS.dumpRoutesAsXml) ?? false
}

export function canSendMessage(node: MBeanNode): boolean {
  if (!isEndpointNode(node)) return false

  const context = findContext(node)
  return context?.hasInvokeRights(ENDPOINT_OPERATIONS.sendBodyAndHeaders, ENDPOINT_OPERATIONS.sendStringBody) ?? false
}

export function canBrowseMessages(node: MBeanNode): boolean {
  if (!isEndpointNode(node)) return false
  if (!node.hasOperations('browseMessageAsXml')) return false

  return node.hasInvokeRights(ENDPOINT_OPERATIONS.browseAllMessagesAsXml, ENDPOINT_OPERATIONS.browseRangeMessagesAsXml)
}

export function canViewEndpointStats(node: MBeanNode): boolean {
  const registry = getDefaultRuntimeEndpointRegistry(node)
  const canInvoke = registry?.hasInvokeRights('endpointStatistics') ?? false
  return (
    !isEndpointsFolder(node) &&
    !isEndpointNode(node) &&
    !isComponentsFolder(node) &&
    !isComponentNode(node) &&
    (isContext(node) || isRoutesFolder(node)) &&
    canInvoke
  )
}

export function getDefaultRuntimeEndpointRegistry(node: MBeanNode): MBeanNode | null {
  return findMBean(node, 'services', 'DefaultRuntimeEndpointRegistry')
}

export function hasExchange(node: MBeanNode): boolean {
  return (
    !isEndpointsFolder(node) &&
    !isEndpointNode(node) &&
    !isComponentsFolder(node) &&
    !isComponentNode(node) &&
    (isContext(node) || isRoutesFolder(node) || isRouteNode(node)) &&
    hasInflightRepository(node)
  )
}

export function findTypeConverter(node: MBeanNode): MBeanNode | null {
  return findMBean(node, 'services', 'TypeConverter')
}

export function canListTypeConverters(node: MBeanNode): boolean {
  const tc = findTypeConverter(node)
  return tc?.hasInvokeRights('listTypeConverters') ?? false
}

export function hasTypeConverter(node: MBeanNode): boolean {
  return (
    !isRouteNode(node) &&
    !isRouteXmlNode(node) &&
    !isEndpointsFolder(node) &&
    !isEndpointNode(node) &&
    !isComponentsFolder(node) &&
    !isComponentNode(node) &&
    (isContext(node) || isRoutesFolder(node)) &&
    canListTypeConverters(node)
  )
}

export function findTraceMBean(node: MBeanNode): MBeanNode | null {
  return findMBean(node, 'tracer', 'BacklogTracer')
}

export function findDebugMBean(node: MBeanNode): MBeanNode | null {
  return findMBean(node, 'tracer', 'BacklogDebugger')
}

/**
 * Returns the name of operation for getting all the breakpoints on the BacklogDebugger
 * MBean. The operation name differs between Camel v3 and v4.
 */
export function getBreakpointsOperation(node: MBeanNode): string {
  return isCamelVersionEQGT(node, 4, 0) ? 'breakpoints' : 'getBreakpoints'
}

/**
 * Returns the name of operation for getting all the suspended breakpoint IDs on
 * the BacklogDebugger MBean. The operation name differs between Camel v3 and v4.
 */
export function getSuspendedBreakpointNodeIdsOperation(node: MBeanNode): string {
  return isCamelVersionEQGT(node, 4, 0) ? 'suspendedBreakpointNodeIds' : 'getSuspendedBreakpointNodeIds'
}

/**
 * Executes the operation for dumping traced messages as XML on the BacklogDebugger
 * MBean. The operation name differs between Camel v3 and v4.
 */
export function dumpTracedMessagesAsXml(node: MBeanNode, debugMBean: string, breakpointId: string): Promise<string> {
  if (isCamelVersionEQGT(node, 4, 0)) {
    return jolokiaService.execute(debugMBean, 'dumpTracedMessagesAsXml(java.lang.String,boolean)', [
      breakpointId,
      false,
    ]) as Promise<string>
  } else {
    return jolokiaService.execute(debugMBean, 'dumpTracedMessagesAsXml(java.lang.String)', [
      breakpointId,
    ]) as Promise<string>
  }
}

export function canGetBreakpoints(node: MBeanNode): boolean {
  if (!isRouteNode(node)) return false

  const db = findDebugMBean(node)
  return db?.hasInvokeRights(getBreakpointsOperation(node)) ?? false
}

export function canTrace(node: MBeanNode): boolean {
  if (!isRouteNode(node)) return false

  const trace = findTraceMBean(node)
  return trace?.hasInvokeRights('dumpAllTracedMessagesAsXml') ?? false
}

export function findRestRegistryBean(node: MBeanNode): MBeanNode | null {
  return findMBean(node, 'services', 'DefaultRestRegistry')
}

export function canListRestServices(node: MBeanNode): boolean {
  const registry = findRestRegistryBean(node)
  return registry?.hasInvokeRights('listRestServices') ?? false
}

export function hasRestServices(node: MBeanNode): boolean {
  if (!isContext(node) && !isRoutesFolder(node)) return false
  if (!canListRestServices(node)) return false

  const registry = findRestRegistryBean(node)
  return registry ? true : false
}

export function hasProperties(node: MBeanNode): boolean {
  return isRouteNode(node) || isRouteXmlNode(node)
}

export function canEnableDisableProcessor(node: MBeanNode, id: string): boolean {
  if (!isRouteNode(node) && !isRoutesFolder(node)) return false

  const processor = findMBean(node, 'processors', id)
  return processor?.hasInvokeRights('enable', 'disable') ?? false
}

function enableOrDisableProcessor(node: MBeanNode, id: string, op: 'enable' | 'disable') {
  if (!isRouteNode(node) && !isRoutesFolder(node)) return

  if (!isCamelVersionEQGT(node, 4, 14)) {
    eventService.notify({
      type: 'warning',
      message: 'Enabling/disabling processors requires Camel version 4.14 or later',
    })
    return
  }

  const processor = findMBean(node, 'processors', id)
  if (!processor) {
    eventService.notify({ type: 'danger', message: `Processor '${id}' not found` })
    return
  }
  const { objectName } = processor
  if (!objectName) {
    eventService.notify({ type: 'danger', message: `Processor '${id}' has no ObjectName` })
    return
  }
  if (!processor.hasInvokeRights(op)) {
    eventService.notify({ type: 'danger', message: `No rights to invoke the ${op} operation` })
    return
  }

  jolokiaService.execute(objectName, op)
}

export function enableProcessor(node: MBeanNode, id: string) {
  enableOrDisableProcessor(node, id, 'enable')
}

export function disableProcessor(node: MBeanNode, id: string) {
  enableOrDisableProcessor(node, id, 'disable')
}

// ----- Camel version helper functions ----------------------------------------

export async function getCamelVersions(): Promise<string[]> {
  const { version: camel4_14Version } = await import('@hawtio/camel-model-v4_14/package.json')
  const { version: camel4_18Version } = await import('@hawtio/camel-model-v4_18/package.json')
  return [camel4_14Version, camel4_18Version]
}

/**
 * Returns the corresponding version of Camel model based on the Camel version of
 * the given node.
 */
export async function getCamelModel(node: MBeanNode): Promise<CamelModel> {
  // 4.18 ~     => 4.18.x
  // 4.0 ~ 4.17 => 4.14.x
  if (isCamelVersionEQGT(node, 4, 18)) {
    return (await import('@hawtio/camel-model-v4_18')) as unknown as CamelModel
  }
  if (isCamelVersionEQGT(node, 4, 14)) {
    return (await import('@hawtio/camel-model-v4_14')) as unknown as CamelModel
  }
  // Fallback to 4.14.x model
  return (await import('@hawtio/camel-model-v4_14')) as unknown as CamelModel
}

/**
 * Fetch the camel version and add it to the tree to avoid making a blocking call
 * elsewhere.
 */
export async function fetchCamelVersion(contextNode: MBeanNode) {
  const version = contextNode.getMetadata('version')
  if (!isBlank(version)) {
    // Already retrieved
    return
  }

  if (!contextNode.objectName) {
    log.warn('Camel version not available due to absence of ObjectName in context node:', contextNode)
    return
  }

  const camelVersion = (await jolokiaService.readAttribute(contextNode.objectName, 'CamelVersion').catch(e => {
    eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(e) })
    return 'unknown'
  })) as string
  contextNode.addMetadata('version', camelVersion)
}

export function getCamelVersion(node: MBeanNode): string | null {
  const ctxNode = findContext(node)
  if (!ctxNode) return null

  return ctxNode.getMetadata('version') ?? null
}

export function compareVersions(version: string, major: number, minor: number): number {
  const arr = version.split('.')

  // parse int or default to 0
  const vmaj = parseInt(arr[0] ?? '0') || 0
  const vmin = parseInt(arr[1] ?? '0') || 0
  if (vmaj < major) return -1
  if (vmaj > major) return 1

  // vmaj == major
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
export function isCamelVersionEQGT(node: MBeanNode, major: number, minor: number): boolean {
  const camelVersion = getCamelVersion(node)
  if (!camelVersion) {
    return false
  }

  return compareVersions(camelVersion, major, minor) >= 0
}
