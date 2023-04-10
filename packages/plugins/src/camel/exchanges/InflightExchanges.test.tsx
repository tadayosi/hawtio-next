import { render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import { MBeanNode, MBeanTree, workspace } from '__root__/shared'
import { CamelContext } from '../context'
import { InflightExchanges } from './InflightExchanges'
import { jmxDomain } from '../globals'
import { camelTreeProcessor } from '__root__/camel/tree-processor'
import { Exchange } from './exchanges-service'
import { jolokiaService } from '__root__/connect'
import fs from 'fs'
import path from 'path'

const routesXmlPath = path.resolve(__dirname, '..', 'testdata', 'camel-sample-app-routes.xml')
const sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })

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

let xchgs: Exchange[] = []
let canDisplayInflightExchanges = false

/**
 * This has to be outside of the describe and test blocks.
 * Otherwise, it is ignored & the real function is used
 */
jest.mock('./exchanges-service', () => {
  return {
    getInflightExchanges: jest.fn(async () => {
      console.log('using mocked getInflightExchanges()')
      return Promise.resolve(xchgs)
    }),
    canBrowseInflightExchanges: jest.fn(async (node: MBeanNode): Promise<boolean> => {
      return Promise.resolve(canDisplayInflightExchanges)
    }),
  }
})

describe('InflightExchanges', () => {
  let tree: MBeanTree

  beforeAll(async () => {
    tree = await workspace.getTree()
    camelTreeProcessor(tree)
  })

  beforeEach(async () => {
    xchgs = [] // reset xchgs to empty
    canDisplayInflightExchanges = true // reset for each test
  })

  test('default values', async () => {
    canDisplayInflightExchanges = false
    render(<InflightExchanges />)

    expect(screen.getByTestId('exchanges-denied')).toHaveTextContent(
      'Browsing of Inflight Exchanges has not been enabled.',
    )
  })

  test('selected node provided no exchanges', async () => {
    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    const selectedNode = contextNode
    const setSelectedNode = () =>
      void (
        {
          /* no op */
        }
      )
    render(
      <CamelContext.Provider value={{ tree, selectedNode, setSelectedNode }}>
        <InflightExchanges />
      </CamelContext.Provider>,
    )

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading'))

    const noXchgs = await screen.findByTestId('no-exchanges')
    expect(noXchgs).toHaveTextContent('No inflight exchanges')
  })

  test('selected node provided with exchanges', async () => {
    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    // Populate xchgs with data
    xchgs = [
      {
        exchangeId: '11111',
        nodeId: '22222',
        routeId: 'route1',
        duration: '999',
        elapsed: '100',
        fromRouteId: 'route1',
      },
    ]

    const selectedNode = contextNode
    const setSelectedNode = () =>
      void (
        {
          /* no op */
        }
      )
    render(
      <CamelContext.Provider value={{ tree, selectedNode, setSelectedNode }}>
        <InflightExchanges />
      </CamelContext.Provider>,
    )

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading'))

    const tblXchgs = await screen.findByTestId('exchange-table')
    expect(tblXchgs).toBeInTheDocument()

    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(2)

    const colNames = screen.getAllByRole('columnheader')
    expect(colNames.length).toBe(5)
    expect(colNames[0]).toHaveTextContent('Exchange ID')
    expect(colNames[1]).toHaveTextContent('Route ID')
    expect(colNames[2]).toHaveTextContent('Node ID')
    expect(colNames[3]).toHaveTextContent('Duration (ms)')
    expect(colNames[4]).toHaveTextContent('Elapsed (ms)')

    const data = screen.getAllByRole('cell')
    expect(data.length).toBe(5)
    expect(data[0]).toHaveTextContent(xchgs[0].exchangeId)
    expect(data[1]).toHaveTextContent(xchgs[0].routeId)
    expect(data[2]).toHaveTextContent(xchgs[0].nodeId)
    expect(data[3]).toHaveTextContent(xchgs[0].duration)
    expect(data[4]).toHaveTextContent(xchgs[0].elapsed)
  })

  test('selected node provided with exchanges but browsing disabled', async () => {
    canDisplayInflightExchanges = false

    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    const contextsNode: MBeanNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    const contextNode: MBeanNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).not.toBeNull()

    // Populate xchgs with data
    xchgs = [
      {
        exchangeId: '11111',
        nodeId: '22222',
        routeId: 'route1',
        duration: '999',
        elapsed: '100',
        fromRouteId: 'route1',
      },
    ]

    const selectedNode = contextNode
    const setSelectedNode = () =>
      void (
        {
          /* no op */
        }
      )
    render(
      <CamelContext.Provider value={{ tree, selectedNode, setSelectedNode }}>
        <InflightExchanges />
      </CamelContext.Provider>,
    )

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading'))

    expect(screen.getByTestId('exchanges-denied')).toHaveTextContent(
      'Browsing of Inflight Exchanges has not been enabled.',
    )
  })
})
