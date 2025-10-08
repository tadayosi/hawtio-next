import { MBeanNode } from '@hawtiosrc/plugins/shared'
import { Table, Tbody, Td, Tr } from '@patternfly/react-table'
import React, { RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Connection,
  ConnectionLineType,
  Handle,
  Node,
  NodeProps,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { camelPreferencesService } from '../camel-preferences-service'
import { CamelContext } from '../context'
import { log } from '../globals'
import { Annotation, RouteDiagramContext } from '../route-diagram-context'
import { routesService } from '../routes-service'
import './RouteDiagram.css'
import { CamelNodeData, visualizationService } from './visualization-service'
import { Button } from '@patternfly/react-core'
import { getCamelVersion, isCamelVersionEQGT } from '../camel-service'

export const RouteDiagram: React.FunctionComponent = () => {
  const canvasRef = useRef<HTMLDivElement>(null)

  return (
    <div id='camel-route-diagram-outer-div' ref={canvasRef}>
      <ReactFlowProvider>
        <ReactFlowRouteDiagram parent={canvasRef} />
      </ReactFlowProvider>
    </div>
  )
}

type ReactFlowRouteDiagramProps = {
  parent: RefObject<HTMLDivElement>
}

const ReactFlowRouteDiagram: React.FunctionComponent<ReactFlowRouteDiagramProps> = props => {
  const { selectedNode } = useContext(CamelContext)
  const { setGraphNodeData, graphSelection, setGraphSelection } = useContext(RouteDiagramContext)
  const previousSelectedNodeRef = useRef<MBeanNode | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const nodesInitialized = useNodesInitialized({ includeHiddenNodes: false })
  const [wrapperDimensions, setWrapperDimensions] = useState({ width: 0, height: 0 })
  const { fitView } = useReactFlow()
  const [statsXml, setStatsXml] = useState('')
  const nodeTypes = useMemo(() => ({ camel: CamelNode }), [])

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges(eds => addEdge({ ...params, type: ConnectionLineType.SmoothStep, animated: true }, eds)),
    [setEdges],
  )

  /*
   * Finds the dimensions of the parent div and assigns the
   * width and height to state for use with fitView useEffect
   */
  useEffect(() => {
    if (props.parent.current) {
      const { width, height } = props.parent.current.getBoundingClientRect()
      setWrapperDimensions({ width, height })
    }
  }, [props.parent])

  /*
   * Only when we are sure the nodes have properly initialized
   * (nodes have dimensions), should fitView be called on the
   * viewport of the graph.
   * see https://github.com/xyflow/xyflow/issues/533
   */
  useEffect(() => {
    let timer: NodeJS.Timeout

    // Ensure nodes have been rendered and wrapper dimensions are valid
    if (nodesInitialized && wrapperDimensions.width > 0 && wrapperDimensions.height > 0) {
      timer = setTimeout(() => {
        // Don't pass the wrapperDimensions to fitView directly.
        // React Flow implicitly uses the dimensions of its parent container.

        fitView({
          padding: 0.25, // Keep some padding around the nodes
          duration: 500, // Smooth transition
        })
      }, 100) // Small delay to ensure rendering has completed
      return // No change in fundamental route, no need to refit
    }

    return () => clearTimeout(timer)
  }, [selectedNode, nodesInitialized, fitView, wrapperDimensions.width, wrapperDimensions.height])

  // Tracks if selectedNode did change
  useEffect(() => {
    // Only proceed if selectedNode has actually changed (not just a re-render with same node)
    if (selectedNode === previousSelectedNodeRef.current) {
      return // No change in fundamental route, no need to refit
    }
    previousSelectedNodeRef.current = selectedNode // Update ref for next render

    const xml = selectedNode?.getMetadata('xml')
    if (!selectedNode || !xml) {
      setNodes([])
      setEdges([])
      return
    }

    visualizationService
      .loadRouteXmlNodes(selectedNode, xml)
      .then(({ camelNodes, edges }) => {
        setGraphNodeData(camelNodes.map(camelNode => camelNode.data))

        const { layoutedNodes, layoutedEdges } = visualizationService.getLayoutedElements(camelNodes, edges)

        layoutedNodes.forEach(node => {
          node.selected = graphSelection === node.data.cid
        })

        setEdges(layoutedEdges)
        setNodes(layoutedNodes)
      })
      .catch(error => {
        log.error(`Error loading the diagram route for ${selectedNode}:`, error)
        setNodes([])
        setEdges([])
      })
  }, [selectedNode, setEdges, setNodes, setGraphNodeData, graphSelection])

  // The useEffect specifically for updating stats within existing nodes
  useEffect(() => {
    if (!selectedNode) return

    const fetchStats = async () => {
      try {
        const xml = await routesService.dumpRoutesStatsXML(selectedNode)
        if (xml) {
          setStatsXml(xml)
        }
      } catch (error) {
        log.error(`Error fetching stats in the diagram route for ${selectedNode}:`, error)
      }
    }

    fetchStats() // Fetch on initial load/selectedNode change
    const interval = setInterval(fetchStats, 2000) // Fetch periodically
    return () => clearInterval(interval) // Cleanup interval
  }, [selectedNode])

  // useEffect for applying stats to nodes (when statsXml changes)
  useEffect(() => {
    if (statsXml && nodes.length > 0) {
      // Only update stats if we have nodes and statsXml is available
      // Ensure you're not recreating all nodes if only stats change
      setNodes(nds => visualizationService.updateStats(statsXml, nds))
    }
  }, [statsXml, setNodes, nodes.length])

  if (!selectedNode) {
    return null
  }

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    setGraphSelection(node.data.cid)
  }

  return (
    <div className='camel-route-diagram'>
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        connectionLineType={ConnectionLineType.SmoothStep}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        elementsSelectable={true}
        onNodeClick={onNodeClick}
      />
    </div>
  )
}

const CamelNode: React.FunctionComponent<NodeProps<CamelNodeData>> = ({
  data,
  selected,
  sourcePosition,
  targetPosition,
}) => {
  const { showStatistics, doubleClickAction, annotations } = useContext(RouteDiagramContext)
  const [isVisible, setVisible] = useState(false)
  const [showFull] = useState(false)
  const [annotation, setAnnotation] = useState<Annotation | undefined>(undefined)

  const { showInflightCounter } = camelPreferencesService.loadOptions()

  useEffect(() => {
    if (!annotations || annotations.length === 0) {
      setAnnotation(undefined)
      return
    }

    const ann = annotations.find(a => a.nodeId === data.cid)
    setAnnotation(ann)
  }, [annotations, data.cid])

  const handleDoubleClick = (_e: React.MouseEvent<HTMLDivElement>) => {
    doubleClickAction?.(data)
  }

  const truncate = (label: string) => {
    const newline = label.indexOf('\n')
    if (label.length < 20 && newline === -1) return label

    const newLabel = label.replace('\n', ' ')
    return newLabel.substring(0, 17) + '...'
  }

  const totalExchanges =
    parseInt(data.stats?.exchangesCompleted ?? '0') + parseInt(data.stats?.exchangesInflight ?? '0')

  return (
    <div
      className={'camel-node-content' + (selected ? ' highlighted' : '')}
      onMouseEnter={() => showStatistics && setVisible(true)}
      onMouseLeave={() => showStatistics && setVisible(false)}
      onDoubleClick={handleDoubleClick}
    >
      <CamelNodeActions />
      <Handle type='target' position={targetPosition ?? Position.Top} />
      <Handle type='source' position={sourcePosition ?? Position.Bottom} id='a' />
      <div className='annotation'>{annotation?.element}</div>
      <div className='icon'>{data.imageUrl}</div>
      <div className='inflights'>{showInflightCounter && data.stats?.exchangesInflight}</div>
      <div className='number'>{totalExchanges}</div>
      <div className='camel-node-label'>{truncate(data.label)}</div>
      {data.cid && <div className='camel-node-id'> (ID: {data.cid})</div>}
      {showStatistics && (
        <NodeToolbar isVisible={isVisible} position={Position.Bottom} style={{ marginTop: '-30px' }}>
          <div className='node-tooltip'>
            {!data.stats && data.label}
            {data.stats && !showFull && (
              <Table variant='compact'>
                <Tbody style={{ fontSize: 'xx-small' }}>
                  <Tr className='node-tooltip-odd-row'>
                    <Td>ID</Td>
                    <Td className='node-tooltip-value'>{data.stats.id}</Td>
                  </Tr>
                  <Tr className='node-tooltip-even-row'>
                    <Td>Total</Td>
                    <Td className='node-tooltip-value'>{totalExchanges}</Td>
                  </Tr>
                  <Tr className='node-tooltip-odd-row'>
                    <Td>Completed</Td>
                    <Td className='node-tooltip-value'>{data.stats?.exchangesCompleted}</Td>
                  </Tr>
                  <Tr className='node-tooltip-even-row'>
                    <Td>Inflight</Td>
                    <Td className='node-tooltip-value'>{data.stats?.exchangesInflight}</Td>
                  </Tr>
                  <Tr className='node-tooltip-odd-row'>
                    <Td>Last</Td>
                    <Td className='node-tooltip-value'>{data.stats?.lastProcessingTime} (ms)</Td>
                  </Tr>
                  <Tr className='node-tooltip-even-row'>
                    <Td>Mean</Td>
                    <Td className='node-tooltip-value'>{data.stats?.meanProcessingTime} (ms)</Td>
                  </Tr>
                  <Tr className='node-tooltip-odd-row'>
                    <Td>Min</Td>
                    <Td className='node-tooltip-value'>{data.stats?.minProcessingTime} (ms)</Td>
                  </Tr>
                  <Tr className='node-tooltip-even-row'>
                    <Td>Max</Td>
                    <Td className='node-tooltip-value'>{data.stats?.maxProcessingTime} (ms)</Td>
                  </Tr>
                </Tbody>
              </Table>
            )}

            {data.stats && showFull && (
              //TODO finish full statistics
              <Table variant='compact'>
                <Tbody style={{ fontSize: 'xx-small' }}>
                  {Object.entries(data.stats).map(s => {
                    return (
                      <Tr key={s[0]}>
                        <Td>{s[0]}</Td>
                        <Td>{s[1]}</Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            )}
          </div>
        </NodeToolbar>
      )}
    </div>
  )
}

const CamelNodeActions: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)

  if (!selectedNode) {
    return null
  }

  const isCamel4_14 = isCamelVersionEQGT(selectedNode, 4, 14)
  if (!isCamel4_14) {
    return null
  }

  return (
    <NodeToolbar position={Position.Right}>
      <div>{getCamelVersion(selectedNode)}</div>
      <Button variant='secondary' size='sm'>Disable</Button>
    </NodeToolbar>
  )
}
