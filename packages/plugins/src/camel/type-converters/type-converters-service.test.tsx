import { MBeanNode, MBeanTree, workspace } from '__root__/shared'
import { jmxDomain } from '../globals'
import { camelTreeProcessor } from '../tree-processor'
import { jolokiaService } from '__root__/connect'
import * as tcs from './type-converters-service'
import fs from 'fs'
import path from 'path'
import { AttributeValues } from '__root__/connect/jolokia-service'

const routesXmlPath = path.resolve(__dirname, '..', 'testdata', 'camel-sample-app-routes.xml')
const sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })

const testStats: tcs.TypeConvertersStats = {
  attemptCounter: 5,
  hitCounter: 4,
  missCounter: 3,
  failedCounter: 2,
}

let canDisplayTypeConvertersStatistics = false

/**
 * Mock the routes xml to provide a full tree
 */
jest.mock('__root__/connect/jolokia-service')
jolokiaService.execute = jest.fn(async (mbean: string, operation: string, args?: unknown[]): Promise<unknown> => {
  if (
    mbean === 'org.apache.camel:context=SampleCamel,type=context,name="SampleCamel"' &&
    operation === 'dumpRoutesAsXml()'
  ) {
    return sampleRoutesXml
  }

  return ''
})

jolokiaService.readAttributes = jest.fn(async (mbean: string): Promise<AttributeValues> => {
  if (mbean.endsWith('DefaultTypeConverter')) {
    const av: AttributeValues = {
      AttemptCounter: testStats.attemptCounter,
      HitCounter: testStats.hitCounter,
      MissCounter: testStats.missCounter,
      FailedCounter: testStats.failedCounter,
    }
    return av
  }

  return {}
})

jolokiaService.readAttribute = jest.fn(async (mbean: string, attr: string): Promise<unknown> => {
  if (attr === 'StatisticsEnabled') {
    return canDisplayTypeConvertersStatistics
  }

  return false
})

jolokiaService.writeAttribute = jest.fn(async (mbean: string, attr: string, value: unknown): Promise<unknown> => {
  if (attr === 'StatisticsEnabled') {
    canDisplayTypeConvertersStatistics = value as boolean
  }

  return true
})

describe('type-converters-service', () => {
  let tree: MBeanTree

  beforeAll(async () => {
    tree = await workspace.getTree()
    camelTreeProcessor(tree)
  })

  beforeEach(async () => {
    canDisplayTypeConvertersStatistics = false
    // xchgs = [] // reset xchgs to empty
  })

  test('getStatisticsEnablement', async () => {
    canDisplayTypeConvertersStatistics = true

    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    const state = await tcs.getStatisticsEnablement(contextNode)
    expect(state).toBeTruthy()
  })

  test('setStatisticsEnablement', async () => {
    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    await tcs.setStatisticsEnablement(contextNode, true)
    expect(canDisplayTypeConvertersStatistics).toBeTruthy()
  })

  test('getStatistics', async () => {
    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    const stats = await tcs.getStatistics(contextNode)
    expect(stats).toEqual(testStats)
  })
})
