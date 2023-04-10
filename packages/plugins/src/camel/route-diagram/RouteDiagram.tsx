import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CamelContext } from '../context'
import ReactFlow, {
  addEdge,
  Connection,
  ConnectionLineType,
  Edge,
  Handle,
  NodeProps,
  NodeToolbar,
  Position,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import { CamelNodeData, visualizationService } from './visualization-service'
import 'reactflow/dist/style.css'
import './routeDiagram.css'
import { Page } from '@patternfly/react-core'

const CamelNode = ({ data, sourcePosition, targetPosition }: NodeProps<CamelNodeData>) => {
  const [isVisible, setVisible] = useState(false)

  return (
    <div className='camelNodeContent' onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      <Handle type='target' position={targetPosition ?? Position.Top} />
      <Handle type='source' position={sourcePosition ?? Position.Bottom} id='a' />

      <div className={'icon'}>
        {data.imageUrl}
        {/*TODO add total exchanges*/}
        <div className='number'>1298</div>
      </div>

      <div className={'camelNodeLabel'}> {data.label}</div>

      <NodeToolbar isVisible={isVisible} position={Position.Bottom} color={'white'}>
        <div style={{ backgroundColor: 'white' }}>TODO: here will be additional route/node stuff</div>
      </NodeToolbar>
    </div>
  )
}

export const RouteDiagram: React.FunctionComponent = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { selectedNode } = useContext(CamelContext)
  const nodeTypes = useMemo(() => ({ camel: CamelNode }), [])

  useEffect(() => {
    const xml = selectedNode?.getProperty('xml')
    if (xml) {
      const { camelNodes, edges } = visualizationService.loadRouteXmlNodes(xml)
      const { nodes: layoutedNodes, edges: layoutedEdges } = visualizationService.getLayoutedElements(
        camelNodes,
        edges as Edge[],
      )
      setNodes([...layoutedNodes])
      setEdges([...layoutedEdges])
    }
  }, [selectedNode, setEdges, setNodes])

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges(eds => addEdge({ ...params, type: ConnectionLineType.SmoothStep, animated: true }, eds)),
    [setEdges],
  )

  return (
    <Page className='routeDiagramPage'>
      <div className='routeDiagram'>
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          connectionLineType={ConnectionLineType.SmoothStep}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView={false}
        />
      </div>
    </Page>
  )
}
