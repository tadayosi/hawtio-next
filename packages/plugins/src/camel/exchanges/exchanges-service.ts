import { MBeanNode } from '__root__/shared/tree'
import { findContext, hasType } from '../camel-content-service'
import { mbeansType, routeNodeType } from '../globals'
import { jolokiaService } from '__root__/connect'

export type Exchange = {
  exchangeId: string
  routeId: string
  nodeId: string
  duration: string
  elapsed: string
  fromRouteId: string
}

export const INFLIGHT_SERVICE = 'DefaultInflightRepository'
export const BLOCKED_SERVICE = 'DefaultAsyncProcessorAwaitManager'

export async function getInflightExchanges(node: MBeanNode): Promise<Exchange[]> {
  return await getExchanges(node, INFLIGHT_SERVICE)
}

export async function getBlockedExchanges(node: MBeanNode): Promise<Exchange[]> {
  return await getExchanges(node, BLOCKED_SERVICE)
}

export async function getExchanges(node: MBeanNode, serviceName: string): Promise<Exchange[]> {
  const ctxNode = findContext(node)
  if (!ctxNode) return Promise.resolve([])

  const service = ctxNode.navigate(mbeansType, 'services', serviceName + '*') as MBeanNode
  if (!service) return Promise.resolve([])

  const response = await jolokiaService.execute(service.objectName as string, 'browse()')
  let exchanges = Object.values(response as object) as Exchange[]
  if (hasType(node, routeNodeType)) {
    exchanges = exchanges.filter(ex => ex.routeId === node.name)
  }

  exchanges.sort((a: Exchange, b: Exchange) => a.exchangeId.localeCompare(b.exchangeId))
  return exchanges
}

export async function unblockExchange(node: MBeanNode, exchange: Exchange): Promise<unknown> {
  const ctxNode = findContext(node)
  // TODO Do we need to reject here if context cannot be found?
  if (!ctxNode) return Promise.resolve(null)

  const service = ctxNode.navigate(mbeansType, 'services', BLOCKED_SERVICE + '*') as MBeanNode
  // TODO Do we need to reject here if service cannot be found?
  if (!service) return Promise.resolve(null)

  const response = await jolokiaService.execute(service.objectName as string, 'interrupt(java.lang.String)', [
    exchange.exchangeId,
  ])
  return Promise.resolve(response)
}

/**
 * Checks the inflight repository service if browsing has been enabled.
 * See the Camel InflightRepository#isInflightBrowseEnabled for details
 */
export async function canBrowseInflightExchanges(node: MBeanNode): Promise<boolean> {
  const ctxNode = findContext(node)
  if (!ctxNode) return Promise.resolve(false)

  const service = ctxNode.navigate(mbeansType, 'services', INFLIGHT_SERVICE + '*') as MBeanNode
  if (!service) return Promise.resolve(false)

  const response = await jolokiaService.readAttribute(service.objectName as string, 'InflightBrowseEnabled')
  return response as boolean
}
