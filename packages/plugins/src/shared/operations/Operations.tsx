import { isEmpty } from '@hawtio/react/util/objects'
import { Card, CardBody, DataList, Text } from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import React, { useContext } from 'react'
import { PluginNodeSelectionContext } from '__root__/selectionNodeContext'
import { createOperations } from './operation'
import { OperationForm } from './OperationForm'
import './Operations.css'

export const Operations: React.FunctionComponent = () => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)

  if (!selectedNode || !selectedNode.objectName || !selectedNode.mbean) {
    return null
  }

  const objectName = selectedNode.objectName
  const mbean = selectedNode.mbean

  if (isEmpty(mbean.op)) {
    return (
      <Card>
        <CardBody>
          <Text component='p'>
            <InfoCircleIcon /> This MBean has no JMX operations.
          </Text>
        </CardBody>
      </Card>
    )
  }

  const operations = createOperations(objectName, mbean.op)

  const OperationList = () => (
    <DataList id='jmx-operation-list' aria-label='operation list' isCompact>
      {operations.map(op => (
        <OperationForm key={op.name} name={op.name} operation={op} />
      ))}
    </DataList>
  )

  return (
    <Card isFullHeight>
      <CardBody>
        <Text component='p'>
          This MBean supports the following JMX operations. Expand an item in the list to invoke that operation.
        </Text>
      </CardBody>
      <CardBody>
        <OperationList />
      </CardBody>
    </Card>
  )
}
