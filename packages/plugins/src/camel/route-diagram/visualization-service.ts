import { schemaService } from '__root__/camel/schema-service'
import { routesService } from '__root__/camel/routes-service'
import { parseXML } from '@hawtio/react/util/xml'
import { Edge, Position, Node } from 'reactflow'
import { ReactNode } from 'react'
import dagre from 'dagre'

export type CamelNodeData = {
  id: string
  name: string
  label: string
  labelSummary: string
  group: 1

  elementId: string | null
  imageUrl: ReactNode
  cid: string
  tooltip: string
  type: string
  uri: string
}

class VisualizationService {
  dagreGraph: dagre.graphlib.Graph
  nodeWidth = 250
  nodeHeight = 80
  defaultMaximumLabelWidth = 34
  edgeType = 'smoothstep'

  constructor() {
    this.dagreGraph = new dagre.graphlib.Graph()
    this.dagreGraph.setDefaultEdgeLabel(() => ({}))
  }
  getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
    const isHorizontal = direction === 'LR'
    this.dagreGraph.setGraph({ rankdir: direction })

    nodes.forEach(node => {
      this.dagreGraph.setNode(node.id, { width: this.nodeWidth, height: this.nodeHeight })
    })

    edges.forEach(edge => {
      this.dagreGraph.setEdge(edge.source, edge.target)
    })
    dagre.layout(this.dagreGraph)

    const nw = nodes.map(node => {
      const nodeWithPosition = this.dagreGraph.node(node.id)
      node.targetPosition = isHorizontal ? Position.Left : Position.Top
      node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom

      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      node.position = {
        x: nodeWithPosition.x - this.nodeWidth / 2,
        y: nodeWithPosition.y - this.nodeHeight / 2,
      }

      return node
    })

    return { nodes: nw, edges }
  }

  getRouteNodeUri(node: Element) {
    let uri: string | null = ''
    if (node) {
      uri = node.getAttribute('uri')
      if (!uri) {
        const ref = node.getAttribute('ref')
        if (ref) {
          const method = node.getAttribute('method')
          if (method) {
            uri = ref + '.' + method + '()'
          } else {
            uri = 'ref:' + ref
          }
        }
      }
    }
    return uri
  }

  loadRouteXmlNodes(xml: string, selectedRouteId?: string) {
    const nodes: CamelNodeData[] = []
    const links: Edge[] = []
    const doc: XMLDocument = parseXML(xml as string)
    const allRoutes = doc.getElementsByTagName('route')

    for (const route of allRoutes) {
      const routeId = route.getAttribute('id')
      if (!selectedRouteId || !routeId || selectedRouteId === routeId) {
        this.addRouteXmlChildren(route, nodes, links, '')
      }
    }
    const camelNodes = nodes.map(node => ({ id: node.id, data: node, position: { x: 0, y: 0 }, type: 'camel' }))
    const edges = links.map(edge => ({ ...edge, markerEnd: { type: 'arrow' }, type: this.edgeType, animated: true }))
    return { camelNodes, edges }
  }
  addRouteXmlChildren(
    parent: Element,
    nodes: CamelNodeData[],
    links: Edge[],
    parentId: string,
    parentNode: CamelNodeData | null = null,
  ) {
    let rid = parent.getAttribute('id')
    let siblingNodes: number[] = []
    const parenNodeName: string = parent.localName

    for (const route of parent.children) {
      const id: string = nodes.length + ''
      // from acts as a parent even though its a previous sibling :)
      const nodeId = route.localName
      if (nodeId === 'from' && parentId !== '-1') {
        parentId = id
      }
      const nodeSettings = schemaService.getSchema(nodeId)
      let node: CamelNodeData | null = null
      if (nodeSettings) {
        let label: string = (nodeSettings['title'] as string) || (nodeId as string)
        const uri = this.getRouteNodeUri(route)
        if (uri) {
          label += ` ${uri.split('?')[0]}`
        }
        let tooltip = (nodeSettings['tooltip'] || nodeSettings['description'] || label) as string
        if (uri) {
          tooltip += ' ' + uri
        }
        const elementID = route.getAttribute('id')
        let labelSummary = label
        if (elementID) {
          const customId = route.getAttribute('customId')
          if (!customId || customId === 'false') {
            labelSummary = 'id: ' + elementID
          } else {
            label = elementID
          }
        }
        // lets check if we need to trim the label
        const labelLimit = this.defaultMaximumLabelWidth
        const length = label.length
        if (length > labelLimit) {
          labelSummary = label + '\n\n' + labelSummary
          label = label.substring(0, labelLimit) + '..'
        }
        const imageUrl = routesService.getIcon(nodeSettings)

        if ((nodeId === 'from' || nodeId === 'to') && uri) {
          const uriIdx = uri.indexOf(':')
          if (uriIdx > 0) {
            const componentScheme = uri.substring(0, uriIdx)
            if (componentScheme) {
              // const value = routesService.getIcon(componentScheme)
              // if (value) {
              //   imageUrl = Core.url(value)
              // }
            }
          }
        }

        let cid = route.getAttribute('_cid') || route.getAttribute('id')
        node = {
          id: id,
          name: nodeId,
          label: label,
          labelSummary: labelSummary,
          group: 1,
          elementId: elementID,
          imageUrl: imageUrl,
          cid: cid ?? id,
          tooltip: tooltip,
          type: nodeId,
          uri: uri ?? '',
        }
        if (rid) {
          node.cid = rid
        }
        if (!cid) {
          cid = nodeId + (nodes.length + 1)
        }
        if (cid) {
          node.cid = cid
        }
        // only use the route id on the first from node
        rid = null
        nodes.push(node)
        if (parentId !== null && parentId !== id) {
          if (siblingNodes.length === 0 || parenNodeName === 'choice') {
            links.push({ id: parentId + '-' + id, source: parentId + '', target: id })
          } else {
            siblingNodes.forEach(function (nodeId) {
              links.push({ id: nodeId + '-' + id, source: nodeId + '', target: id })
            })
            siblingNodes.length = 0
          }
        }
      } else {
        // ignore non EIP nodes, though we should add expressions...
        const langSettings = { name: 'sfd' } // Camel.camelLanguageSettings(nodeId)
        if (langSettings && parentNode) {
          // lets add the language kind
          const name = langSettings['name'] || nodeId
          const text = route.textContent

          if (text) {
            parentNode.tooltip = parentNode.label + ' ' + name + ' ' + text
            parentNode.label += ': ' + this.appendLabel(route, text, true)
          } else {
            parentNode.label += ': ' + this.appendLabel(route, name, false)
          }
        }
      }

      const siblings = this.addRouteXmlChildren(route, nodes, links, id, node)
      if (parenNodeName === 'choice') {
        siblingNodes = siblingNodes.concat(siblings)
      } else if (
        nodeId === 'aggregate' ||
        nodeId === 'choice' ||
        nodeId === 'delay' ||
        nodeId === 'filter' ||
        nodeId === 'loadBalance' ||
        nodeId === 'loop' ||
        nodeId === 'multicast' ||
        nodeId === 'resequence' ||
        nodeId === 'split' ||
        nodeId === 'doTry' ||
        nodeId === 'doCatch' ||
        nodeId === 'doFinally' ||
        nodeId === 'idempotentConsumer' ||
        nodeId === 'onCompletion'
      ) {
        siblingNodes = siblings
      } else {
        siblingNodes = [nodes.length - 1]
      }
    }
    return siblingNodes
  }
  appendLabel(route: Element, label: string, text: boolean): string {
    switch (route.localName) {
      case 'method':
        if (!text) {
          if (route.getAttribute('bean')) {
            label += ' ' + route.getAttribute('bean')
          } else if (route.getAttribute('ref')) {
            label += ' ' + route.getAttribute('ref')
          } else if (route.getAttribute('beanType')) {
            label += ' ' + route.getAttribute('beanType')
          }
        }
        if (route.getAttribute('method')) {
          label += ' ' + route.getAttribute('method')
        }
        break
      default:
    }
    return label
  }
}
export const visualizationService = new VisualizationService()
