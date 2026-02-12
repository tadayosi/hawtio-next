import { userService } from '@hawtiosrc/auth'
import { camelTreeProcessor } from '@hawtiosrc/plugins/camel/tree-processor'
import { MBeanTree, jolokiaService, workspace } from '@hawtiosrc/plugins/shared'
import { render, screen } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { CamelTreeView } from './CamelTreeView'
import { CamelContext } from './context'
import { camelContexts, jmxDomain, pluginName } from './globals'

const routesXmlPath = path.resolve(__dirname, 'testdata', 'camel-sample-app-routes.xml')
const sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })

/**
 * Mock out useNavigate() and useLocation() to allow the tests to work
 */
const mockedUsedNavigate = jest.fn()
const mockedUseLocation = jest.fn()
jest.mock('react-router-dom', () => ({
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  ...(jest.requireActual('react-router-dom') as any),
  useNavigate: () => mockedUsedNavigate,
  useLocation: () => mockedUseLocation,
}))

/**
 * Mock the routes xml to provide a full tree
 */
jest.mock('@hawtiosrc/plugins/shared/jolokia-service')
jolokiaService.execute = jest.fn(async (mbean: string, operation: string, args?: unknown[]): Promise<unknown> => {
  if (
    mbean === 'org.apache.camel:context=SampleCamel,type=context,name="SampleCamel"' &&
    operation === 'dumpRoutesAsXml()'
  ) {
    return sampleRoutesXml
  }

  return ''
})

const selectedNode = null
const setSelectedNode = () => {
  /* no-op */
}

describe('CamelTreeView', () => {
  let tree: MBeanTree

  beforeAll(async () => {
    // Set up the test to be under login state
    await userService.fetchUser()

    const wkspTree = await workspace.getTree()
    await camelTreeProcessor(wkspTree)
    const rootNode = wkspTree.find(node => node.name === jmxDomain)

    if (rootNode) {
      const ctxNode = rootNode.getChildren()[0]
      tree = MBeanTree.createFromNodes(pluginName, ctxNode?.getChildren() ?? [])
    }
  })

  test('Tree Display', async () => {
    expect(tree).not.toBeUndefined()

    const domainNode = tree.get(jmxDomain)
    expect(domainNode).toBeNull()

    render(
      <CamelContext.Provider value={{ tree, selectedNode, setSelectedNode }}>
        <CamelTreeView />
      </CamelContext.Provider>,
    )

    const domainItem = screen.queryByLabelText(jmxDomain)
    expect(domainItem).toBeNull()
    const contextsItem = screen.queryByLabelText(camelContexts)
    expect(contextsItem).toBeNull()
    const ctxItem = screen.queryByLabelText('SampleCamel')
    expect(ctxItem).not.toBeNull()
  })
})
