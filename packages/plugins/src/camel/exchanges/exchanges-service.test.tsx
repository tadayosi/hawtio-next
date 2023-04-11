import { MBeanNode, MBeanTree, jolokiaService, workspace } from '@hawtio/react'
import fs from 'fs'
import path from 'path'
import { jmxDomain } from '../globals'
import { camelTreeProcessor } from '../tree-processor'
import * as exs from './exchanges-service'

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
jest.mock('@hawtio/react', () => {
  const originalModule = jest.requireActual('@hawtio/react')
  return {
    __esModule: true,
    ...originalModule,
    jolokiaService: jest.fn(),
  }
})
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

// TODO: Skip tests as they don't work in a separated package. Should be fixed to make them work.
describe.skip('exchange-service', () => {
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
