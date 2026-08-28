import { PluginNodeSelectionContext } from '@hawtiosrc/plugins/context'
import { HawtioEmptyCard, HawtioLoadingCard } from '@hawtiosrc/plugins/shared'
import { AttributeValues } from '@hawtiosrc/plugins/shared/jolokia-service'
import { isObject, objectSorter } from '@hawtiosrc/util/objects'
import { Drawer, DrawerContent, DrawerContentBody, Panel } from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, ThProps, Tr } from '@patternfly/react-table'
import Jolokia from 'jolokia.js'
import React, { useContext, useEffect, useState } from 'react'
import { log } from '../globals'
import { attributeService } from './attribute-service'
import { AttributeModal } from './AttributeModal'

export const Attributes: React.FunctionComponent = () => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)
  const [attributes, setAttributes] = useState<AttributeValues>({})
  const [isReading, setIsReading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState({ name: '', value: '' })
  const [reload, setReload] = useState(false)

  useEffect(() => {
    if (!selectedNode || !selectedNode.mbean || !selectedNode.objectName) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReading(true)
    const { objectName } = selectedNode
    attributeService.readWithCallback(objectName, attrs => {
      setAttributes(attrs)
      setIsReading(false)
    })

    attributeService.register({ type: 'read', mbean: objectName }, response => {
      if (!Jolokia.isResponseFetchError(response) && !Jolokia.isError(response)) {
        log.debug('Scheduler - Attributes:', response.value)
        setAttributes(response.value as AttributeValues)
      }
    })

    return () => attributeService.unregisterAll()
  }, [selectedNode])

  useEffect(() => {
    if (!selectedNode || !selectedNode.mbean || !selectedNode.objectName || !reload) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReading(true)
    const { objectName } = selectedNode
    attributeService.readWithCallback(objectName, attrs => {
      setAttributes(attrs)
      setIsReading(false)
    })

    setReload(false)
  }, [selectedNode, reload])

  if (!selectedNode || !selectedNode.mbean || !selectedNode.objectName) {
    return null
  }

  if (isReading) {
    return <HawtioLoadingCard />
  }

  const rows: { name: string; value: string }[] = Object.entries(attributes).map(([name, value]) => ({
    name: name,
    value: isObject(value) ? JSON.stringify(value) : String(value),
  }))

  if (rows.length === 0) {
    return <HawtioEmptyCard message='This MBean has no attributes.' />
  }

  const selectAttribute = (attribute: { name: string; value: string }) => {
    setSelected(attribute)
    if (!isModalOpen) {
      setIsModalOpen(true)
    }
  }

  const getSortParams = (): ThProps['sort'] => ({
    sortBy: {
      index: 0,
      direction: sortDirection,
      defaultDirection: 'asc', // starting sort direction when first sorting a column. Defaults to 'asc'
    },
    onSort: (_event, _index, direction) => {
      setSortDirection(direction)
    },
    columnIndex: 0,
  })

  const panelContent = (
    <AttributeModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onUpdate={() => setReload(true)}
      input={selected}
    />
  )

  const attributesTable = (
    <div id='attribute-table-with-panel'>
      <Table aria-label='Attributes' variant='compact'>
        <Thead>
          <Tr>
            <Th sort={getSortParams()}>Attribute</Th>
            <Th>Value</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows
            .sort((a, b) => objectSorter(a.name, b.name, sortDirection === 'desc'))
            .map((att, index) => (
              <Tr
                key={att.name + '-' + index}
                isClickable
                isRowSelected={selected.name === att.name}
                onRowClick={() => selectAttribute(att)}
              >
                <Td>{att.name}</Td>
                <Td>{att.value}</Td>
              </Tr>
            ))}
        </Tbody>
      </Table>
    </div>
  )
  return (
    <Panel>
      <Drawer isExpanded={isModalOpen} className='pf-m-inline-on-2xl'>
        <DrawerContent panelContent={panelContent}>
          <DrawerContentBody>{attributesTable}</DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </Panel>
  )
}
