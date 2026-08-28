import { userService } from '@hawtiosrc/auth'
import { MBeanNode, MBeanTree, workspace } from '@hawtiosrc/plugins/shared'
import { jolokiaService } from '@hawtiosrc/plugins/shared/jolokia-service'
import fs from 'fs'
import path from 'path'
import * as camelService from './camel-service'
import {
  camelContexts,
  componentsType,
  contextNodeType,
  contextsType,
  endpointsType,
  jmxDomain,
  mbeansType,
  routeNodeType,
  routesType,
} from './globals'
import { camelTreeProcessor } from './tree-processor'

jest.mock('@hawtiosrc/plugins/shared/jolokia-service')

const CAMEL_MODEL_VERSION = '3.20.2'

/**
 * This has to be outside of the describe and test blocks.
 * Otherwise, it is ignored & the real function is used
 */
jest.mock('./camel-service', () => {
  return {
    ...jest.requireActual('./camel-service'),
    fetchCamelVersion: jest.fn((contextNode: MBeanNode | null) => {
      if (contextNode) contextNode.addMetadata('version', CAMEL_MODEL_VERSION)
    }),
  }
})

describe('tree-processor', () => {
  let tree: MBeanTree

  const routesXmlPath = path.resolve(__dirname, 'testdata', 'camel-sample-app-routes.xml')
  const routesWithGroupsXmlPath = path.resolve(__dirname, 'testdata', 'camel-sample-app-routes-with-groups.xml')
  const routesWithSingleGroupXmlPath = path.resolve(
    __dirname,
    'testdata',
    'camel-sample-app-routes-with-single-group.xml',
  )
  let sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })

  jolokiaService.execute = jest.fn(async (mbean: string, operation: string, args?: unknown[]): Promise<unknown> => {
    if (
      mbean === 'org.apache.camel:context=SampleCamel,type=context,name="SampleCamel"' &&
      operation === 'dumpRoutesAsXml()'
    ) {
      return sampleRoutesXml
    }

    return ''
  })

  beforeAll(async () => {
    // Set up the test to be under login state
    await userService.fetchUser()
  })

  beforeEach(async () => {
    tree = await workspace.getTree()
    workspace.refreshTree()
    sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })
  })

  test('processor', async () => {
    expect(tree.isEmpty()).toBeFalsy()

    await camelTreeProcessor(tree)

    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    expect(domainNode.childCount()).toBe(1)

    const contextsNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    expect(camelService.hasDomain(contextsNode)).toBeTruthy()
    expect(contextsNode.getType()).toBe(contextsType)
    expect(contextsNode.id).toBe('org.apache.camel-CamelContexts-folder')
    expect(contextsNode.name).toBe(camelContexts)
    expect(contextsNode.childCount()).toBe(1)

    const contextNode = contextsNode.getIndex(0) as MBeanNode
    expect(camelService.hasDomain(contextNode)).toBeTruthy()
    expect(contextNode.getType()).toBe(contextNodeType)
    expect(contextNode.id).toBe('org.apache.camel-CamelContexts-SampleCamel-folder')
    expect(contextNode.name).toBe('SampleCamel')
    expect(camelService.getCamelVersion(contextNode)).toBe(CAMEL_MODEL_VERSION)
    expect(contextNode.childCount()).toBe(4)

    const types = [routesType, endpointsType, componentsType, mbeansType]
    for (const type of types) {
      const node = contextNode.get(type, true) as MBeanNode
      expect(node).toBeDefined()
      expect(camelService.hasDomain(node)).toBeTruthy()
      expect(node.getType()).toBe(type)
      expect(node.id).toEqual(`org.apache.camel-CamelContexts-SampleCamel-${type}-folder`)
      expect(node.name).toBe(type)
      expect(camelService.getCamelVersion(node)).toBe(CAMEL_MODEL_VERSION)
      expect(node.childCount()).toBeGreaterThan(0)
    }

    const routesNode = contextNode.get(routesType, true) as MBeanNode
    for (const child of routesNode.getChildren()) {
      expect(child).toBeDefined()
      expect(camelService.hasDomain(child)).toBeTruthy()
      expect(child.getType()).toBe(routeNodeType)
    }
  })

  test('processor-with-single-group', async () => {
    sampleRoutesXml = fs.readFileSync(routesWithSingleGroupXmlPath, { encoding: 'utf8', flag: 'r' })
    expect(tree.isEmpty()).toBeFalsy()

    await camelTreeProcessor(tree)

    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    expect(domainNode.childCount()).toBe(1)

    const contextsNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()

    const contextNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).toBeDefined()
    expect(contextNode.childCount()).toBe(4)

    const routesNode = contextNode.get(routesType, true) as MBeanNode
    expect(routesNode).toBeDefined()
    expect(routesNode.childCount()).toBe(2)

    const group1Node = routesNode.get('group1', true) as MBeanNode
    expect(group1Node).toBeDefined()
    expect(group1Node.childCount()).toBe(1)

    // non-grouped route added under default route group
    const defaultNode = routesNode.get('default', true) as MBeanNode
    expect(defaultNode).toBeDefined()
    expect(defaultNode.childCount()).toBe(1)
  })

  test('processor-with-groups', async () => {
    sampleRoutesXml = fs.readFileSync(routesWithGroupsXmlPath, { encoding: 'utf8', flag: 'r' })
    expect(tree.isEmpty()).toBeFalsy()

    await camelTreeProcessor(tree)

    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    expect(domainNode.childCount()).toBe(1)

    const contextsNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()

    const contextNode = contextsNode.getIndex(0) as MBeanNode
    expect(contextNode).toBeDefined()
    expect(contextNode.childCount()).toBe(4)

    const routesNode = contextNode.get(routesType, true) as MBeanNode
    expect(routesNode).toBeDefined()
    expect(routesNode.childCount()).toBe(2)

    const group1Node = routesNode.get('group1', true) as MBeanNode
    expect(group1Node).toBeDefined()
    expect(group1Node.childCount()).toBe(1)

    const group2Node = routesNode.get('group2', true) as MBeanNode
    expect(group2Node).toBeDefined()
    expect(group2Node.childCount()).toBe(1)
  })
})
