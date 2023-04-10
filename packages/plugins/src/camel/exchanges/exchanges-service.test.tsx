import { MBeanNode, MBeanTree, workspace } from '__root__/shared'
import { jmxDomain } from '../globals'
import { camelTreeProcessor } from '__root__/camel/tree-processor'
import { jolokiaService } from '__root__/connect'
import * as exs from './exchanges-service'
import fs from 'fs'
import path from 'path'

const routesXmlPath = path.resolve(__dirname, '..', 'testdata', 'camel-sample-app-routes.xml')
const sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })

let xchgs: exs.Exchange[] = []

const dummyExchg = {
  exchangeId: '11111',
  nodeId: '22222',
  routeId: 'route1',
  duration: '999',
  elapsed: '100',
  fromRouteId: 'route1',
}

let dummyIsBlocked = true
let inflightBrowseEnabled = true

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
  } else if (mbean.endsWith(exs.INFLIGHT_SERVICE) && operation === 'browse()') {
    xchgs = [dummyExchg]
    return xchgs
  } else if (mbean.endsWith(exs.BLOCKED_SERVICE) && operation === 'browse()') {
    if (dummyIsBlocked) xchgs = [dummyExchg]
    return xchgs
  } else if (operation === 'interrupt(java.lang.String)' && args && args[0] === dummyExchg.exchangeId) {
    dummyIsBlocked = false // unblock the dummy exchange
    xchgs = xchgs.filter(ex => ex.exchangeId !== dummyExchg.exchangeId)
    return xchgs
  }

  return ''
})

jolokiaService.readAttribute = jest.fn(async (mbean: string, attr: string): Promise<unknown> => {
  if (attr === 'InflightBrowseEnabled') {
    return Promise.resolve(inflightBrowseEnabled)
  }

  return Promise.resolve(false)
})

describe('exchange-service', () => {
  let tree: MBeanTree

  beforeAll(async () => {
    tree = await workspace.getTree()
    camelTreeProcessor(tree)
  })

  beforeEach(async () => {
    xchgs = [] // reset xchgs to empty
  })

  test('getInflightExchanges', async () => {
    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    const resXchgs = await exs.getInflightExchanges(contextNode)
    expect(resXchgs.length).toBe(1)
  })

  test('getBlockedExchanges', async () => {
    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    const resXchgs = await exs.getBlockedExchanges(contextNode)
    expect(resXchgs.length).toBe(1)
  })

  test('unblockExchange', async () => {
    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    // Specify that the dummy exchange is blocked
    dummyIsBlocked = true

    let resXchgs = await exs.getBlockedExchanges(contextNode)
    expect(resXchgs.length).toBe(1)

    await exs.unblockExchange(contextNode, resXchgs[0])

    resXchgs = await exs.getBlockedExchanges(contextNode)
    expect(resXchgs.length).toBe(0)
  })

  test('canBrowseInflightExchanges', async () => {
    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    let canBrowse = await exs.canBrowseInflightExchanges(contextNode)
    expect(canBrowse).toBeTruthy()

    inflightBrowseEnabled = false
    canBrowse = await exs.canBrowseInflightExchanges(contextNode)
    expect(canBrowse).toBeFalsy()
  })
})
