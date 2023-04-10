import { AttributeValues } from '__root__/connect/jolokia-service'
import { isObject } from '@hawtio/react/util/objects'
import { Card, CardBody, Text } from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import { OnRowClick, Table, TableBody, TableHeader, TableProps } from '@patternfly/react-table'
import { IResponse } from 'jolokia.js'
import { useEffect, useState, useContext } from 'react'
import { PluginNodeSelectionContext } from '__root__/selectionNodeContext'
import { log } from '../globals'
import { attributeService } from './attribute-service'
import { AttributeModal } from './AttributeModal'

export const Attributes: React.FunctionComponent = () => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)
  const [attributes, setAttributes] = useState<AttributeValues>({})
  const [isReading, setIsReading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selected, setSelected] = useState({ name: '', value: '' })

  useEffect(() => {
    if (!selectedNode || !selectedNode.mbean || !selectedNode.objectName) {
      return
    }

    setIsReading(true)
    const objectName = selectedNode.objectName
    const readAttributes = async () => {
      const attrs = await attributeService.read(objectName)
      setAttributes(attrs)
      setIsReading(false)
    }
    readAttributes()
  }, [selectedNode])

  useEffect(() => {
    if (!selectedNode || !selectedNode.mbean || !selectedNode.objectName) {
      return
    }

    const mbean = selectedNode.objectName
    attributeService.register({ type: 'read', mbean }, (response: IResponse) => {
      log.debug('Scheduler - Attributes:', response.value)
      setAttributes(response.value as AttributeValues)
    })

    return () => attributeService.unregisterAll()
  }, [selectedNode])

  if (!selectedNode || !selectedNode.mbean || !selectedNode.objectName) {
    return null
  }

  if (isReading) {
    return (
      <Card>
        <CardBody>
          <Text component='p'>Reading attributes...</Text>
        </CardBody>
      </Card>
    )
  }

  const columns: TableProps['cells'] = ['Attribute', 'Value']
  const rows: TableProps['rows'] = Object.entries(attributes).map(([name, value]) => [
    name,
    isObject(value) ? JSON.stringify(value) : String(value),
  ])

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody>
          <Text component='p'>
            <InfoCircleIcon /> This MBean has no attributes.
          </Text>
        </CardBody>
      </Card>
    )
  }

  const selectAttribute: OnRowClick = (_event, row) => {
    const name = row[0]
    const value = row[1]
    setSelected({ name, value })
    handleModalToggle()
  }

  const handleModalToggle = () => {
    setIsModalOpen(!isModalOpen)
  }

  return (
    <Card isFullHeight>
      <Table aria-label='Attributes' variant='compact' cells={columns} rows={rows}>
        <TableHeader />
        <TableBody onRowClick={selectAttribute} />
      </Table>
      <AttributeModal isOpen={isModalOpen} onClose={handleModalToggle} input={selected} />
    </Card>
  )
}
