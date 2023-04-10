import { jolokiaService } from '__root__/connect/jolokia-service'
import { MBeanNode, MBeanTree, workspace } from '__root__/shared'
import {
  camelContexts,
  componentsType,
  contextNodeType,
  contextsType,
  endpointsType,
  jmxDomain,
  routesType,
  mbeansType,
  routeNodeType,
} from './globals'
import * as ccs from './camel-content-service'
import { camelTreeProcessor } from './tree-processor'
import fs from 'fs'
import path from 'path'

jest.mock('__root__/connect/jolokia-service')

const CAMEL_MODEL_VERSION = '3.20.2'

/**
 * This has to be outside of the describe and test blocks.
 * Otherwise, it is ignored & the real function is used
 */
jest.mock('./camel-content-service', () => {
  return {
    ...jest.requireActual('./camel-content-service'),
    setCamelVersion: jest.fn((contextNode: MBeanNode | null) => {
      if (contextNode) contextNode.addProperty('version', CAMEL_MODEL_VERSION)
    }),
  }
})

describe('tree-processor', () => {
  let tree: MBeanTree

  const routesXmlPath = path.resolve(__dirname, 'testdata', 'camel-sample-app-routes.xml')
  const sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })

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
    tree = await workspace.getTree()
  })

  test('processor', () => {
    expect(tree.isEmpty()).toBeFalsy()

    camelTreeProcessor(tree)

    const domainNode: MBeanNode = tree.get(jmxDomain) as MBeanNode
    expect(domainNode).not.toBeNull()
    expect(domainNode.childCount()).toBe(1)

    const contextsNode = domainNode.getIndex(0) as MBeanNode
    expect(contextsNode).not.toBeNull()
    expect(ccs.hasDomain(contextsNode)).toBeTruthy()
    expect(ccs.hasType(contextsNode, contextsType)).toBeTruthy()
    expect(contextsNode.id).toBe(`${camelContexts}-1`)
    expect(contextsNode.name).toBe(camelContexts)
    expect(contextsNode.childCount()).toBe(1)

    const contextNode = contextsNode.getIndex(0) as MBeanNode
    expect(ccs.hasDomain(contextNode)).toBeTruthy()
    expect(ccs.hasType(contextNode, contextNodeType)).toBeTruthy()
    expect(contextNode.id).toBe('SampleCamel-1')
    expect(contextNode.name).toBe('SampleCamel')
    expect(ccs.getCamelVersion(contextNode)).toBe(CAMEL_MODEL_VERSION)
    expect(contextNode.childCount()).toBe(4)

    const types = [routesType, endpointsType, componentsType, mbeansType]
    for (const t of types) {
      const n = contextNode.get(t) as MBeanNode
      expect(n).toBeDefined()
      expect(ccs.hasDomain(n)).toBeTruthy()
      expect(ccs.hasType(n, t)).toBeTruthy()
      expect(n.id).toMatch(new RegExp(`^${t}-[0-9]+`))
      expect(n.name).toBe(t)
      expect(ccs.getCamelVersion(n)).toBe(CAMEL_MODEL_VERSION)
      expect(n.childCount()).toBeGreaterThan(0)
    }

    const routesNode = contextNode.get(routesType) as MBeanNode
    for (const c of routesNode.getChildren()) {
      expect(c).toBeDefined()
      expect(ccs.hasDomain(c)).toBeTruthy()
      expect(ccs.hasType(c, routeNodeType)).toBeTruthy()
    }
  })
})
