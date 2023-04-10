import { parseXML } from '@hawtio/react/util/xml'
import { AttributeValues, jolokiaService } from '__root__/connect/jolokia-service'
import { MBeanNode } from '__root__/shared/tree'
import React from 'react'
import * as ccs from './camel-content-service'
import { log, routeXmlNodeType } from './globals'
import * as icons from './icons'
import { schemaService } from './schema-service'

export type CamelRoute = {
  objectName: string
  RouteId: string
  State: string
  Uptime: string
  ExchangesCompleted: number
  ExchangesFailed: number
  FailuresHandled: number
  ExchangesTotal: number
  ExchangesInflight: number
  MeanProcessingTime: number
}

class RoutesService {
  getIcon(nodeSettingsOrXmlNode: Record<string, unknown> | Element): React.ReactNode {
    let nodeSettings: Record<string, unknown> | null = null

    if (nodeSettingsOrXmlNode instanceof Element) {
      const nodeName = nodeSettingsOrXmlNode.localName
      if (nodeName) {
        nodeSettings = schemaService.getSchema(nodeName)
      }
    } else {
      nodeSettings = nodeSettingsOrXmlNode
    }

    if (nodeSettings) {
      const nsObj: Record<string, unknown> = nodeSettings as Record<string, unknown>
      const iconName: string = (nsObj['icon'] as string) || 'generic24.png'

      // transform name into icon component name
      let iname = iconName.replace('.png', '') // Remove png file extension
      iname = iname.replace('24', '') // Remove 24 suffix
      iname = iname.replace('-icon', '') // Remove -icon suffix
      iname = iname.replace('icon', '') // Remove remaining icon suffix
      iname = iname.charAt(0).toUpperCase() + iname.slice(1) // Capitalize
      iname = iname.replace(/-([a-z])/g, (g: string) => {
        return g[1].toUpperCase()
      })
      iname = `${iname}Icon`

      //
      // Fetch the correct FunctionComponent icon from the icons module
      //
      return icons.getIcon(iname)
    }

    return null
  }

  /**
   * Adds a child to the given folder / route
   * @method
   */
  private loadRouteChild(parent: MBeanNode, routeXml: Element): MBeanNode | null {
    const nodeName = routeXml.localName
    const nodeSettings = schemaService.getSchema(nodeName)
    if (nodeSettings) {
      const id = routeXml.getAttribute('id') || nodeName
      const node = new MBeanNode(null, id, nodeName, false)
      ccs.setType(node, routeXmlNodeType)
      ccs.setDomain(node)
      const icon: React.ReactNode = this.getIcon(nodeSettings)
      node.setIcons(icon)

      // TODO - tooltips to be implemented
      // updateRouteNodeLabelAndTooltip(node, route, nodeSettings)

      this.loadRouteChildren(node, routeXml)
      return node
    }

    return null
  }

  /**
   * Adds the route children to the given folder for each step in the route
   * @method
   */
  loadRouteChildren(routeNode: MBeanNode, routeXml: Element) {
    routeNode.addProperty('xml', routeXml.outerHTML)
    for (const childXml of routeXml.children) {
      const child = this.loadRouteChild(routeNode, childXml)
      if (child) routeNode.adopt(child)
    }
  }

  /**
   * Gets routes xml from the context node
   * @param contextNode
   */
  async getRoutesXml(contextNode: MBeanNode | null): Promise<string | null> {
    if (!contextNode) {
      return null
    }

    const mbeanName = contextNode.objectName
    if (!mbeanName) {
      throw new Error('Cannot process route xml as mbean name not available')
    }

    let xml = null
    try {
      xml = await jolokiaService.execute(mbeanName, 'dumpRoutesAsXml()')
    } catch (error) {
      throw new Error('Failed to dump xml from mbean: ' + mbeanName)
    }

    if (!xml) {
      throw new Error('Failed to extract any xml from mbean: ' + mbeanName)
    }

    contextNode.addProperty('xml', xml as string)
    return xml as string
  }
  /**
   * Looks up the route XML for the given context and selected route and
   * processes the selected route's XML with the given function
   * @method processRouteXml
   * @param xml
   * @param routeNode the actual route to be examined
   */
  processRouteXml(xml: string, routeNode: MBeanNode | null): Element | null {
    if (!routeNode) {
      throw new Error('Route node not available')
    }

    const doc: XMLDocument = parseXML(xml as string)
    const route = doc.getElementById(routeNode.name)
    if (!route || route?.tagName?.toLowerCase() !== 'route') {
      throw new Error(`No routes in ${routeNode.name} route xml`)
    }
    return route
  }

  transformXml(contextNode: MBeanNode | null, routesNode: MBeanNode | null) {
    if (!contextNode || !routesNode || routesNode.getProperty('type') !== 'routes') {
      return
    }
    // routesNode.addProperty('xml', routeXml.outerHTML)
    this.getRoutesXml(contextNode).then(xml => {
      if (!xml) return
      routesNode.addProperty('xml', xml)
      routesNode.getChildren().forEach((routeNode: MBeanNode) => {
        try {
          const xmlNode = this.processRouteXml(xml, routeNode)
          if (!xmlNode) return
          this.loadRouteChildren(routeNode, xmlNode)
        } catch (error) {
          log.error(`Failed to process route xml for ${routeNode.name}: ` + error)
        }
      })
    })
  }

  async getRoutesAttributes(routeFolder: MBeanNode | null): Promise<CamelRoute[]> {
    if (!routeFolder) return []

    const children = routeFolder.getChildren()
    if (children.length === 0) return []

    const routes: CamelRoute[] = []
    for (const child of children) {
      if (!child.objectName) continue

      const attributes: AttributeValues = await jolokiaService.readAttributes(child.objectName as string)
      routes.push(this.createCamelRoute(child.objectName as string, attributes))
    }
    return routes
  }

  createCamelRoute(objName: string, attr: AttributeValues) {
    const route: CamelRoute = {
      objectName: objName,
      ExchangesCompleted: attr['ExchangesCompleted'] as number,
      ExchangesTotal: attr['ExchangesTotal'] as number,
      ExchangesInflight: attr['ExchangesInflight'] as number,
      RouteId: attr['RouteId'] as string,
      State: attr['State'] as string,
      Uptime: attr['Uptime'] as string,
      ExchangesFailed: attr['ExchangesFailed'] as number,
      FailuresHandled: attr['FailuresHandled'] as number,
      MeanProcessingTime: attr['MeanProcessingTime'] as number,
    }

    return route
  }
  async startRoute(objName: string) {
    await jolokiaService.execute(objName, 'start()')
  }

  async stopRoute(objName: string) {
    await jolokiaService.execute(objName, 'stop()')
  }

  async deleteRoute(objName: string) {
    await jolokiaService.execute(objName, 'remove()')
  }
}

export const routesService = new RoutesService()
