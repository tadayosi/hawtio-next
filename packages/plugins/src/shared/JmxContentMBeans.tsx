import { useContext } from 'react'
import { Card, CardBody, Text } from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import { OnRowClick, Table, TableBody, TableHeader, TableProps } from '@patternfly/react-table'
import { PluginNodeSelectionContext } from '__root__/selectionNodeContext'
import './JmxContentMBeans.css'

export const JmxContentMBeans: React.FunctionComponent = () => {
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)

  if (!selectedNode) {
    return null
  }

  const columns: TableProps['cells'] = ['MBean', 'Object Name']
  const rows: TableProps['rows'] = (selectedNode.children || []).map(child => [child.name, child.objectName || '-'])

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody>
          <Text component='p'>
            <InfoCircleIcon /> This node has no MBeans.
          </Text>
        </CardBody>
      </Card>
    )
  }

  const selectChild: OnRowClick = (_event, row) => {
    const clicked = row[0]
    const child = selectedNode.children?.find(c => c.name === clicked)
    if (child) {
      setSelectedNode(child)
    }
  }

  return (
    <Card isFullHeight>
      <Table aria-label='MBeans' variant='compact' cells={columns} rows={rows}>
        <TableHeader />
        <TableBody onRowClick={selectChild} className={'jmx-table-body'} />
      </Table>
    </Card>
  )
}
