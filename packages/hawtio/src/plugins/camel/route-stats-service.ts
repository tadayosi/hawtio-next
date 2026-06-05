import { jolokiaService } from '@hawtiosrc/plugins/shared/jolokia-service'
import { MBeanNode } from '@hawtiosrc/plugins/shared/tree'
import { parseXML } from '@hawtiosrc/util/xml'
import { ReactNode } from 'react'
import * as camelService from './camel-service'
import { contextNodeType, log, routeXmlNodeType, routesType, xmlNodeLocalName } from './globals'
import * as icons from './icons'
import { schemaService } from './schema-service'

export type Statistics = {
  id: string
  state: string
  exchangesInflight?: string
  exchangesCompleted?: string
  exchangesTotal?: string
  failuresHandled?: string
  redeliveries?: string
  externalRedeliveries?: string
  minProcessingTime?: string
  maxProcessingTime?: string
  deltaProcessingTime?: string
  meanProcessingTime?: string
  startTimestamp?: string
  resetTimestamp?: string
  lastExchangeFailureExchangeId?: string
  lastExchangeFailureTimestamp?: string
  lastExchangeCreatedTimestamp?: string
  firstExchangeFailureExchangeId?: string
  firstExchangeFailureTimestamp?: string
  lastProcessingTime?: string
  exchangesFailed?: string
  totalProcessingTime?: string
  firstExchangeCompletedTimestamp?: string
  firstExchangeCompletedExchangeId?: string
  lastExchangeCompletedTimestamp?: string
  lastExchangeCompletedExchangeId?: string
  selfProcessingTime?: string
  accumulatedProcessingTime?: string
}

export type ProcessorStats = Statistics & {
  index?: string
  sourceLineNumber?: string
  // Available in Camel 4.14 and later
  disabled?: string
}

export type RouteStats = Statistics & {
  sourceLocation: string
  processorStats: ProcessorStats[]
}

export const ROUTE_OPERATIONS = {
  dumpRoutesAsXml: 'dumpRoutesAsXml()',
  dumpRoutesStatsAsXml: 'dumpRoutesStatsAsXml',
} as const

class RouteStatsService {
  async getIcon(
    node: MBeanNode,
    nodeSettingsOrXmlNode: Record<string, unknown> | Element,
    size?: number,
  ): Promise<ReactNode> {
    let nodeSettings: Record<string, unknown> | null = null

    if (nodeSettingsOrXmlNode instanceof Element) {
      const nodeName = nodeSettingsOrXmlNode.localName
      if (nodeName) {
        nodeSettings = await schemaService.getSchema(node, nodeName)
      }
    } else {
      nodeSettings = nodeSettingsOrXmlNode
    }

    if (!nodeSettings) {
      return null
    }

    const iconName = (nodeSettings['icon'] as string) || 'generic24.png'

    // transform name into icon component name
    let iname = iconName.replace('.png', '') // Remove png file extension
    iname = iname.replace('24', '') // Remove 24 suffix
    iname = iname.replace('-icon', '') // Remove -icon suffix
    iname = iname.replace('icon', '') // Remove remaining icon suffix
    iname = iname.charAt(0).toUpperCase() + iname.slice(1) // Capitalize
    iname = iname.replace(/-([a-z])/g, s => s[1]?.toUpperCase() ?? s)
    iname = `${iname}Icon`

    //
    // Fetch the correct FunctionComponent icon from the icons module
    //
    return icons.getIcon(iname, size)
  }

  /**
   * Populates a route step node with the given XML.
   */
  private async populateStepNode(parent: MBeanNode, stepXml: Element) {
    const nodeSettings = await schemaService.getSchema(parent, stepXml.localName)
    if (!nodeSettings) {
      return
    }

    /*
     * if xml contains an id property then add that to node name
     * if xml contains an uri property then add that to node name
     */
    const xmlId = stepXml.id
    const xmlUri = stepXml.getAttribute('uri')
    const nodeName = (xmlId ? xmlId + ': ' : xmlUri ? xmlUri + ': ' : '') + stepXml.localName

    const node = new MBeanNode(null, nodeName, false)
    node.setType(routeXmlNodeType)
    camelService.setDomain(node)
    node.setIcons(await this.getIcon(parent, nodeSettings))

    // TODO - tooltips to be implemented
    // updateRouteNodeLabelAndTooltip(node, route, nodeSettings)

    // Adopt child before cascading to grandchildren so that the parent is traceable
    // from the child
    parent.adopt(node)

    // Cascade XML loading to the child steps
    await this.loadStepXml(node, stepXml)
  }

  /**
   * Adds the XML to the given step node, and populates its child nodes with the
   * inner steps of the XML.
   */
  private async loadStepXml(stepNode: MBeanNode, stepXml: Element) {
    stepNode.addMetadata('xml', stepXml.outerHTML)
    // Preserve the xml local name for use by views
    stepNode.addMetadata(xmlNodeLocalName, stepXml.localName)

    // Populate child nodes
    for (const childXml of Array.from(stepXml.children)) {
      await this.populateStepNode(stepNode, childXml)
    }
  }

  /**
   * Adds the route XML to the route node, and populates its child nodes with the
   * route steps of the XML.
   */
  async loadRouteXml(routeNode: MBeanNode, routeXml: Element) {
    routeNode.addMetadata('xml', '    ' + routeXml.outerHTML) // Indent route XML for better readability
    // Preserve the xml local name for use by views
    routeNode.addMetadata(xmlNodeLocalName, routeXml.localName)

    // If route is grouped with the 'group' attribute, add it to the node.
    const routeGroup = routeXml.getAttribute('group')
    if (routeGroup) routeNode.addMetadata('group', routeGroup)

    // Populate child nodes
    for (const stepXml of Array.from(routeXml.children)) {
      await this.populateStepNode(routeNode, stepXml)
    }
  }

  /**
   * Fetches the routes XML for the context node from Jolokia.
   */
  async fetchRoutesXml(contextNode: MBeanNode): Promise<string> {
    const { objectName } = contextNode
    if (!objectName) {
      throw new Error('Cannot process route xml as mbean name not available')
    }

    const xml = (await jolokiaService.execute(objectName, ROUTE_OPERATIONS.dumpRoutesAsXml)) as string
    if (!xml) {
      throw new Error('Failed to extract any xml from mbean: ' + objectName)
    }

    return xml
  }

  /**
   * Looks up the routes XML for the selected route and processes the selected route's XML.
   */
  processRouteXml(xml: string, routeNode: MBeanNode): Element {
    const doc = parseXML(xml)

    /*
     * Fetches route elements and then checks the tag id property
     * This is superior to fetching an element by id as it is possible
     * that other types of elements have the same id, which camel allows.
     */

    // Get all elements that are <route> tags
    const routes = doc.getElementsByTagName('route')

    // Find any single route than specifically matches the node id
    const routeXml = Array.from(routes).find(r => r.id === routeNode.name)

    if (!routeXml) {
      throw new Error(`No routes named '${routeNode.name}' found in the routes xml`)
    }
    return routeXml
  }

  /**
   * Loads the routes XML from the context and adds it to the routes and children.
   */
  async loadRoutesXml(contextNode: MBeanNode, routesNode: MBeanNode) {
    if (routesNode.getType() !== 'routes') {
      return
    }

    try {
      const xml = await this.fetchRoutesXml(contextNode)
      routesNode.addMetadata('xml', xml)
      for (const routeNode of routesNode.getChildren()) {
        try {
          const routeXml = this.processRouteXml(xml, routeNode)
          await this.loadRouteXml(routeNode, routeXml)
        } catch (error) {
          log.error(`Failed to process route xml for '${routeNode.name}':`, error)
        }
      }
    } catch (error) {
      log.error(`Failed to load routes xml for '${contextNode.name}':`, error)
    }
  }

  async dumpRoutesStatsXML(routesOrRouteNode: MBeanNode): Promise<string | null> {
    // Find the nearest routes node
    let routesNode: MBeanNode | null = routesOrRouteNode
    let iterations = 0
    const maxIterations = 1000 // reasonable limit to protect against cyclic tree

    try {
      while (routesNode && routesNode.getType() !== routesType) {
        if (iterations++ > maxIterations) {
          throw new Error('Exceeded maximum iterations. Possible cyclical tree structure.')
        }

        routesNode = routesNode.parent
      }

      if (!routesNode) {
        throw new Error(`Cannot find a 'routes' type ancestor for ${routesOrRouteNode.id}`)
      }
    } catch (error) {
      throw new Error(`Failed to dump routes stats from mbean ${routesOrRouteNode.id}: ${error}`)
    }

    /*
     * The routesNode should now be of type routes regardless
     * of whether the selected node was a routes node already
     * or was a sub route diagram from an application with
     * multiple routes.
     */

    let xml = null
    const mbeanName = routesNode.getMetadata(contextNodeType)
    const mbeanToQuery = mbeanName ? mbeanName : (routesNode.parent?.getMetadata(contextNodeType) ?? '')

    try {
      xml = await jolokiaService.execute(mbeanToQuery, ROUTE_OPERATIONS.dumpRoutesStatsAsXml, [true, true])
    } catch (error) {
      throw new Error('Failed to dump routes stats from mbean ' + mbeanName + ': ' + error)
    }
    if (!xml) {
      throw new Error('Failed to extract any xml from mbean ' + mbeanName)
    }
    return xml as string
  }

  processRoutesStats(statsXml: string): RouteStats[] {
    const doc: XMLDocument = parseXML(statsXml)
    const routesStats: RouteStats[] = []
    const allRoutes = doc.getElementsByTagName('routeStat')
    for (const route of allRoutes) {
      routesStats.push(this.createRouteStats(route))
    }
    return routesStats
  }

  createProcessorStats(routeId: string, pDoc: Element): ProcessorStats {
    let res: ProcessorStats = {
      id: '',
      index: '',
      state: '',
    }

    for (const atr of pDoc.getAttributeNames()) {
      res = { ...res, [atr]: pDoc.getAttribute(atr) }
    }
    return res as ProcessorStats
  }

  createRouteStats(pDoc: Element): RouteStats {
    const procStats = pDoc.getElementsByTagName('processorStat')
    const processorStats: ProcessorStats[] = []

    for (const pStat of procStats) {
      processorStats.push(this.createProcessorStats(pDoc.id, pStat))
    }
    let routeStats: RouteStats = { id: '', processorStats: processorStats, sourceLocation: '', state: '' }

    for (const atr of pDoc.getAttributeNames()) {
      routeStats = { ...routeStats, [atr]: pDoc.getAttribute(atr) }
    }
    return routeStats
  }
}

export const routeStatsService = new RouteStatsService()
