import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jolokiaService } from '__root__/connect/jolokia-service'
import { routesService } from './routes-service'
import { MBeanNode } from '__root__/shared/tree'
import fs from 'fs'
import path from 'path'
import { parseXML } from '@hawtio/react/util/xml'
import { IconNames } from './icons'

jest.mock('__root__/connect/jolokia-service')

describe('routes-service', () => {
  let contextNode: MBeanNode
  let routesNode: MBeanNode
  let simpleRouteNode: MBeanNode

  const testRouteId = 'simple'
  const routesXmlPath = path.resolve(__dirname, 'testdata', 'camel-sample-app-routes.xml')
  const sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })
  const routesDoc: XMLDocument = parseXML(sampleRoutesXml as string)
  // eslint-disable-next-line testing-library/no-node-access
  const simpleRouteXml = routesDoc.getElementById(testRouteId) as Element

  jolokiaService.execute = jest.fn(async (mbean: string, operation: string, args?: unknown[]): Promise<unknown> => {
    if (
      mbean === 'org.apache.camel:context=SampleCamel,type=context,name="SampleCamel"' &&
      operation === 'dumpRoutesAsXml()'
    ) {
      return sampleRoutesXml
    }

    return ''
  })

  beforeEach(() => {
    contextNode = new MBeanNode(null, 'SampleCamel', 'sample-camel-1', true)
    contextNode.objectName = 'org.apache.camel:context=SampleCamel,type=context,name="SampleCamel"'

    routesNode = new MBeanNode(null, 'Routes', 'routes-2', true)
    routesNode.addProperty('type', 'routes')

    simpleRouteNode = new MBeanNode(null, 'simple', testRouteId, false)

    routesNode.adopt(simpleRouteNode)
    contextNode.adopt(routesNode)
  })

  test('getRoutesXml', async () => {
    const xml = await routesService.getRoutesXml(contextNode)
    expect(xml).not.toBeNull()
  })

  test('processRouteXml', async () => {
    const route = routesService.processRouteXml(sampleRoutesXml, simpleRouteNode)
    expect(route).not.toBeNull()
    expect((route as Element).id).toBe(testRouteId)
  })

  test('getRoutesXml no contextNode', async () => {
    const nullCtx: MBeanNode | null = null
    const route = await routesService.getRoutesXml(nullCtx)
    expect(route).toBeNull()
  })

  test('getRoutesXml no mbean', async () => {
    contextNode.objectName = undefined
    const t = async () => {
      await routesService.getRoutesXml(contextNode)
    }

    await expect(t).rejects.toThrow('Cannot process route xml as mbean name not available')
  })

  test('getRoutesXml wrong mbean', async () => {
    contextNode.objectName = 'wrong:mbean:name'
    const t = async () => {
      await routesService.getRoutesXml(contextNode)
    }

    await expect(t).rejects.toThrow('Failed to extract any xml from mbean: ' + contextNode.objectName)
  })

  test('loadRouteChildren', async () => {
    routesService.loadRouteChildren(simpleRouteNode, simpleRouteXml)
    expect(simpleRouteNode.getProperty('xml')).toBe(simpleRouteXml.outerHTML)
    expect(simpleRouteNode.childCount()).toBe(4)

    type MBeanAttr = {
      id: string
      name: string
      children?: MBeanAttr[]
    }

    const exp: MBeanAttr[] = [
      { id: 'from', name: 'from' },
      { id: 'setBody2', name: 'setBody' },
      { id: 'to3', name: 'to' },
      { id: 'to4', name: 'to' },
    ]

    for (let i = 0; i < simpleRouteNode.childCount(); ++i) {
      let childNode: MBeanNode | null = simpleRouteNode.getIndex(i)
      expect(childNode).not.toBeNull()
      childNode = childNode as MBeanNode
      expect(childNode.id).toBe(exp[i].id)
      expect(childNode.name).toBe(exp[i].name)
      expect(childNode.getChildren().length).toBe(0)
      expect(childNode.icon).not.toBeNull()
      render(childNode.icon as React.ReactElement)
    }

    expect(screen.getAllByAltText(IconNames.EndpointIcon).length).toBe(3)
    expect(screen.getByAltText(IconNames.SetBodyIcon)).toBeInTheDocument()
    cleanup()
  })
})
