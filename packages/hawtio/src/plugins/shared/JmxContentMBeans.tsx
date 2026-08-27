import React, { useContext } from 'react'
import { Card, CardBody, Panel, ContentVariants, Content } from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'

import { PluginNodeSelectionContext } from '@hawtiosrc/plugins/context'
import './JmxContentMBeans.css'
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon'

export const JmxContentMBeans: React.FunctionComponent = () => {
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)

  if (!selectedNode) {
    return null
  }

  const rows: { name: string; objectName: string }[] = (selectedNode.children || []).map(node => ({
    name: node.name,
    objectName: node.objectName ?? '-',
  }))

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody>
          <Content component={ContentVariants.p}>
            <InfoCircleIcon /> This node has no MBeans.
          </Content>
        </CardBody>
      </Card>
    )
  }

  const selectChild = (clicked: string) => {
    const child = selectedNode.children?.find(c => c.name === clicked)
    if (child) {
      setSelectedNode(child)
    }
  }

  return (
    <Panel>
      <Table aria-label='MBeans' variant='compact'>
        <Thead>
          <Tr>
            <Th width={50}>MBean</Th>
            <Th width={50}>Object Name</Th>
          </Tr>
        </Thead>
        <Tbody className={'jmx-table-body'}>
          {rows.map(r => (
            <Tr key={'row-' + r.name} onClick={() => selectChild(r.name)}>
              <Td>{r.name}</Td>
              <Td>{r.objectName}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Panel>
  )
}
