import { jolokiaService } from '__root__/connect'
import { MBeanNode } from '__root__/shared/tree'
import { findContext } from '../camel-content-service'
import { mbeansType } from '../globals'

export class TypeConvertersStats {
  attemptCounter: number
  hitCounter: number
  missCounter: number
  failedCounter: number

  constructor() {
    this.attemptCounter = 0
    this.hitCounter = 0
    this.missCounter = 0
    this.failedCounter = 0
  }
}

export class TypeConverter {
  constructor(public from: string, public to: string) {
    this.from = from
    this.to = to
  }
}

function getTypeConverterObjectName(node: MBeanNode): string | null {
  const ctxNode = findContext(node)
  if (!ctxNode) return null

  const service = ctxNode.navigate(mbeansType, 'services', '*TypeConverter') as MBeanNode
  if (!service) return null

  return service.objectName as string
}

/**
 * Get the TypeConverter 'StatisticsEnabled' attribute
 * @param node the node selected
 */
export async function getStatisticsEnablement(node: MBeanNode | null): Promise<boolean> {
  if (!node) return false

  const serviceName = getTypeConverterObjectName(node)
  if (!serviceName) return Promise.reject()

  const response = await jolokiaService.readAttribute(serviceName, 'StatisticsEnabled')
  return response as boolean
}

/**
 * Set the TypeConverter 'StatisticsEnabled' attribute
 * @param node the node selected
 * @param state the state of the attribute
 */
export async function setStatisticsEnablement(node: MBeanNode, state: boolean): Promise<unknown> {
  const serviceName = getTypeConverterObjectName(node)
  if (!serviceName) return Promise.reject()

  return jolokiaService.writeAttribute(serviceName, 'StatisticsEnabled', state)
}

/**
 * Reset the TypeConverters counters
 * @param node the node selected
 */
export async function resetStatistics(node: MBeanNode): Promise<unknown> {
  const serviceName = getTypeConverterObjectName(node)
  if (!serviceName) return false

  return await jolokiaService.execute(serviceName, 'resetTypeConversionCounters')
}

/**
 * Get the TypeConverters statistics
 * @param node the node selected
 */
export async function getStatistics(node: MBeanNode | null): Promise<TypeConvertersStats> {
  const stats = new TypeConvertersStats()
  if (!node) return stats

  const serviceName = getTypeConverterObjectName(node)
  if (!serviceName) return stats

  const response = await jolokiaService.readAttributes(serviceName)
  stats.attemptCounter = response['AttemptCounter'] as number
  stats.hitCounter = response['HitCounter'] as number
  stats.missCounter = response['MissCounter'] as number
  stats.failedCounter = response['FailedCounter'] as number
  return stats
}
