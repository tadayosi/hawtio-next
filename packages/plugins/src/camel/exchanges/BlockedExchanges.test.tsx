import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react'
import { MBeanNode, MBeanTree, workspace } from '__root__/shared'
import { CamelContext } from '../context'
import { BlockedExchanges } from './BlockedExchanges'
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

/**
 * This has to be outside of the describe and test blocks.
 * Otherwise, it is ignored & the real function is used
 */
jest.mock('./exchanges-service', () => {
  return {
    getBlockedExchanges: jest.fn(async () => {
      return Promise.resolve(xchgs)
    }),
    unblockExchange: jest.fn(async (node: MBeanNode, exchange: Exchange) => {
      xchgs = xchgs.filter(ex => ex.exchangeId !== exchange.exchangeId)
      expect(xchgs.length).toBe(0)
    }),
  }
})

describe('BlockedExchanges', () => {
  let tree: MBeanTree

  beforeAll(async () => {
    tree = await workspace.getTree()
    camelTreeProcessor(tree)
  })

  beforeEach(async () => {
    xchgs = [] // reset xchgs to empty
  })

  test('default values', async () => {
    render(<BlockedExchanges />)

    expect(screen.getByTestId('no-exchanges')).toHaveTextContent('No blocked exchanges')
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
        <BlockedExchanges />
      </CamelContext.Provider>,
    )
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading'))

    const noXchgs = await screen.findByTestId('no-exchanges')
    expect(noXchgs).toHaveTextContent('No blocked exchanges')
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
        <BlockedExchanges />
      </CamelContext.Provider>,
    )
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading'))

    const tblXchgs = await screen.findByTestId('exchange-table')
    expect(tblXchgs).toBeInTheDocument()

    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(2)

    const colNames = screen.getAllByRole('columnheader')
    expect(colNames.length).toBe(6)
    expect(colNames[0]).toHaveTextContent('Exchange ID')
    expect(colNames[1]).toHaveTextContent('Route ID')
    expect(colNames[2]).toHaveTextContent('Node ID')
    expect(colNames[3]).toHaveTextContent('Duration (ms)')
    expect(colNames[4]).toHaveTextContent('Elapsed (ms)')
    expect(colNames[5]).toHaveAttribute('data-label', 'Action')

    const data = screen.getAllByRole('cell')
    expect(data.length).toBe(6)
    expect(data[0]).toHaveTextContent(xchgs[0].exchangeId)
    expect(data[1]).toHaveTextContent(xchgs[0].routeId)
    expect(data[2]).toHaveTextContent(xchgs[0].nodeId)
    expect(data[3]).toHaveTextContent(xchgs[0].duration)
    expect(data[4]).toHaveTextContent(xchgs[0].elapsed)

    const unblockButton = screen.getByRole('button', { name: /unblock/i })
    expect(unblockButton).toBeInTheDocument()
  })

  test('unblock button click', async () => {
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

    const BlockedXchgs = (
      <CamelContext.Provider value={{ tree, selectedNode, setSelectedNode }}>
        <BlockedExchanges />
      </CamelContext.Provider>
    )

    const { rerender } = render(BlockedXchgs)
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading'))

    let tblXchgs = await screen.findByTestId('exchange-table')
    expect(tblXchgs).toBeInTheDocument()

    /* Find the unblock button */
    const unblockButton = screen.getByRole('button', { name: /unblock/i })
    expect(unblockButton).toBeInTheDocument()

    /* Click the unblock button */
    fireEvent.click(unblockButton)

    /* Re-render the page */
    rerender(BlockedXchgs)

    /* Page should not display the confirm unblock dialog */
    let modal = await screen.findByRole('dialog')
    expect(modal).toBeInTheDocument()

    /* Find the dialog's unblock confirm button */
    const unblockDialogButton = screen.getByTestId('confirm-unblock')
    expect(unblockDialogButton).toBeInTheDocument()

    /* Click the dialog's unblock button */
    fireEvent.click(unblockDialogButton)

    /* Re-render the page */
    rerender(BlockedXchgs)

    /* The confirm dialog should have disappeared */
    modal = await screen.findByRole('dialog')
    expect(modal).not.toBeInTheDocument()

    /* There should be no table in the page */
    tblXchgs = await screen.findByTestId('exchange-table')
    expect(tblXchgs).not.toBeInTheDocument()

    /* There should be the no blocked exchanges message only */
    expect(screen.getByTestId('no-exchanges')).toHaveTextContent('No blocked exchanges')
  })
})
