import { PluginNodeSelectionContext } from '@hawtiosrc/plugins/context'
import { HawtioEmptyCard } from '@hawtiosrc/plugins/shared'
import { isEmpty } from '@hawtiosrc/util/objects'
import { Content, DataList, Panel, PanelHeader, PanelMain, PanelMainBody } from '@patternfly/react-core'
import React, { useContext } from 'react'
import { OperationForm } from './OperationForm'
import './Operations.css'
import { createOperations, Operation } from './operation'

const OperationList: React.FunctionComponent<{
  operations: Operation[],
}> = ({ operations }) => (
    <DataList id='jmx-operation-list' aria-label='operation list' isCompact>
      {operations.map(op => (
          <OperationForm key={op.name} name={op.name} operation={op} />
      ))}
    </DataList>
)

export const Operations: React.FunctionComponent = () => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)

  if (!selectedNode || !selectedNode.mbean) {
    return null
  }

  const { mbean } = selectedNode

  if (!mbean.op || isEmpty(mbean.op)) {
    return <HawtioEmptyCard message='This MBean has no JMX operations.' />
  }

  const operations = createOperations(mbean.op)

  return (
    <Panel>
      <PanelHeader>
        <Content component='p'>
          This MBean supports the following JMX operations. Expand an item in the list to invoke that operation.
        </Content>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          <OperationList operations={operations} />
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
