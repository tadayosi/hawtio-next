import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MBeanNode, MBeanTree } from '__root__/shared/tree'
import { workspace } from '__root__/shared/workspace'
import { CamelContext } from '../context'
import { jmxDomain } from '../globals'
import { camelTreeProcessor } from '../tree-processor'
import { jolokiaService } from '__root__/connect'
import { TypeConvertersStatistics } from './TypeConvertersStatistics'
import { TypeConvertersStats } from './type-converters-service'
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

let testStats: TypeConvertersStats = new TypeConvertersStats()
let canDisplayTypeConvertersStatistics = false

/**
 * This has to be outside of the describe and test blocks.
 * Otherwise, it is ignored & the real function is used
 */
jest.mock('./type-converters-service', () => {
  const originalModule = jest.requireActual('./type-converters-service')
  return {
    ...originalModule,
    getStatisticsEnablement: jest.fn(async (node: MBeanNode | null) => {
      return Promise.resolve(canDisplayTypeConvertersStatistics)
    }),
    setStatisticsEnablement: jest.fn(async (node: MBeanNode, state: boolean): Promise<unknown> => {
      canDisplayTypeConvertersStatistics = state
      return Promise.resolve(true)
    }),
    getStatistics: jest.fn(async (node: MBeanNode | null): Promise<TypeConvertersStats> => {
      return Promise.resolve(testStats)
    }),
  }
})

describe('TypeConvertersStatistics', () => {
  let tree: MBeanTree

  beforeAll(async () => {
    tree = await workspace.getTree()
    camelTreeProcessor(tree)
  })

  beforeEach(async () => {
    canDisplayTypeConvertersStatistics = false // reset for each test
    testStats = new TypeConvertersStats()
  })

  test('default values', async () => {
    // canDisplayTypeConvertersStatistics = false
    render(<TypeConvertersStatistics />)

    await screen.findByTestId('no-stats-available')

    expect(screen.getByTestId('no-stats-available')).toHaveTextContent('No statistics available.')
  })

  test('selected node provided statistics disabled', async () => {
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
        <TypeConvertersStatistics />
      </CamelContext.Provider>,
    )

    await screen.findByTestId('stats-view-list')

    const statsView = await screen.findByTestId('stats-view-list')
    expect(statsView).toBeInTheDocument()
    expect(screen.getByTestId('attemptCounter')).toHaveTextContent('-')
    expect(screen.getByTestId('hitCounter')).toHaveTextContent('-')
    expect(screen.getByTestId('missesCounter')).toHaveTextContent('-')
    expect(screen.getByTestId('failedCounter')).toHaveTextContent('-')
  })

  test('selected node provided statistics enabled', async () => {
    canDisplayTypeConvertersStatistics = true

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
        <TypeConvertersStatistics />
      </CamelContext.Provider>,
    )

    await screen.findByTestId('stats-view-list')

    const statsView = await screen.findByTestId('stats-view-list')
    expect(statsView).toBeInTheDocument()
    expect(screen.getByTestId('attemptCounter')).toHaveTextContent('0')
    expect(screen.getByTestId('hitCounter')).toHaveTextContent('0')
    expect(screen.getByTestId('missesCounter')).toHaveTextContent('0')
    expect(screen.getByTestId('failedCounter')).toHaveTextContent('0')
  })

  test('selected node provided statistics enabled with stats', async () => {
    canDisplayTypeConvertersStatistics = true
    testStats = {
      attemptCounter: 5,
      hitCounter: 4,
      missCounter: 3,
      failedCounter: 2,
    }

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
        <TypeConvertersStatistics />
      </CamelContext.Provider>,
    )

    await screen.findByTestId('stats-view-list')

    const statsView = await screen.findByTestId('stats-view-list')
    expect(statsView).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByTestId('attemptCounter')).toHaveTextContent(String(testStats.attemptCounter)),
    )
    await waitFor(() => expect(screen.getByTestId('hitCounter')).toHaveTextContent(String(testStats.hitCounter)))
    await waitFor(() => expect(screen.getByTestId('missesCounter')).toHaveTextContent(String(testStats.missCounter)))
    await waitFor(() => expect(screen.getByTestId('failedCounter')).toHaveTextContent(String(testStats.failedCounter)))
  })

  test('selected node provided statistics first disabled then enabled', async () => {
    testStats = {
      attemptCounter: 5,
      hitCounter: 4,
      missCounter: 3,
      failedCounter: 2,
    }

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

    const ConverterStats = (
      <CamelContext.Provider value={{ tree, selectedNode, setSelectedNode }}>
        <TypeConvertersStatistics />
      </CamelContext.Provider>
    )

    const { rerender } = render(ConverterStats)

    await screen.findByTestId('stats-view-list')

    let statsView = await screen.findByTestId('stats-view-list')
    expect(statsView).toBeInTheDocument()

    /*
     * The statistics are disabled so expect '-'
     */
    await waitFor(() => expect(screen.getByTestId('attemptCounter')).toHaveTextContent('-'))
    await waitFor(() => expect(screen.getByTestId('hitCounter')).toHaveTextContent('-'))
    await waitFor(() => expect(screen.getByTestId('missesCounter')).toHaveTextContent('-'))
    await waitFor(() => expect(screen.getByTestId('failedCounter')).toHaveTextContent('-'))

    /*
     * Enable the statistics
     */
    const enableButton = screen.getByRole('button', { name: /Enable Statistics/i })
    expect(enableButton).toBeInTheDocument()

    /* Click the unblock button */
    fireEvent.click(enableButton)

    /* Re-render the page */
    rerender(ConverterStats)

    statsView = await screen.findByTestId('stats-view-list')
    expect(statsView).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByTestId('attemptCounter')).toHaveTextContent(String(testStats.attemptCounter)),
    )
    await waitFor(() => expect(screen.getByTestId('hitCounter')).toHaveTextContent(String(testStats.hitCounter)))
    await waitFor(() => expect(screen.getByTestId('missesCounter')).toHaveTextContent(String(testStats.missCounter)))
    await waitFor(() => expect(screen.getByTestId('failedCounter')).toHaveTextContent(String(testStats.failedCounter)))
  })
})
