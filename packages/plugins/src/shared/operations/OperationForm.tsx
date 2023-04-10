import {
  ActionGroup,
  Button,
  Checkbox,
  ClipboardCopy,
  ClipboardCopyVariant,
  DataListAction,
  DataListCell,
  DataListContent,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  DataListToggle,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  Form,
  FormGroup,
  KebabToggle,
  Text,
  TextInput,
  Title,
} from '@patternfly/react-core'
import React, { useContext, useState } from 'react'
import { Operation } from './operation'
import { operationService } from './operation-service'
import { PluginNodeSelectionContext } from '__root__/selectionNodeContext'
import './OperationForm.css'

export interface OperationFormProps {
  name: string
  operation: Operation
}

export const OperationForm: React.FunctionComponent<OperationFormProps> = props => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)
  const { name, operation } = props
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  if (!selectedNode || !selectedNode.objectName || !selectedNode.mbean) {
    return null
  }

  const { objectName } = selectedNode

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const copyMethodName = () => {
    // TODO: impl
  }

  const copyJolokiaURL = () => {
    // TODO: impl
  }

  const OperationCells = () => (
    <DataListItemCells
      dataListCells={[
        <DataListCell key={`operation-cell-name-${name}`} isFilled={false}>
          <b>{operation.readableName}</b>
        </DataListCell>,
        <DataListCell key={`operation-cell-desc-${name}`} isFilled={false}>
          {operation.description}
        </DataListCell>,
      ]}
    />
  )

  const OperationActions = () => (
    <DataListAction
      id={`operation-actions-${name}`}
      aria-label={`operation actions ${name}`}
      aria-labelledby={`${name} operation-actions-${name}`}
    >
      <Dropdown
        key={`operation-action-dropdown-${name}`}
        isPlain
        position={DropdownPosition.right}
        isOpen={isDropdownOpen}
        toggle={<KebabToggle onToggle={handleDropdownToggle} />}
        dropdownItems={[
          <DropdownItem key={`operation-action-copy-method-name-${name}`} onClick={copyMethodName}>
            Copy method name
          </DropdownItem>,
          <DropdownItem key={`operation-action-copy-jolokia-url-${name}`} onClick={copyJolokiaURL}>
            Copy Jolokia URL
          </DropdownItem>,
        ]}
      />
    </DataListAction>
  )

  return (
    <DataListItem key={`operation-${name}`} aria-labelledby={`operation ${name}`} isExpanded={isExpanded}>
      <DataListItemRow>
        <DataListToggle onClick={handleToggle} isExpanded={isExpanded} id='ex-toggle1' aria-controls='ex-expand1' />
        <OperationCells />
        <OperationActions />
      </DataListItemRow>
      <OperationFormContents {...props} objectName={objectName} isExpanded={isExpanded} />
    </DataListItem>
  )
}

type OperationFormContentsProps = OperationFormProps & {
  objectName: string
  isExpanded: boolean
}

const OperationFormContents: React.FunctionComponent<OperationFormContentsProps> = props => {
  const { name, operation, objectName, isExpanded } = props
  const [isExecuting, setIsExecuting] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const defaultValue = (javaType: string) => {
    switch (javaType) {
      case 'boolean':
      case 'java.lang.Boolean':
        return false
      case 'int':
      case 'long':
      case 'java.lang.Integer':
      case 'java.lang.Long':
        return 0
      default:
        return ''
    }
  }
  const [argValues, setArgValues] = useState<unknown[]>(operation.args.map(arg => defaultValue(arg.type)))

  const updateArgValues = (index: number) => (value: boolean | string) => {
    const values = [...argValues]
    values[index] = value
    setArgValues(values)
  }

  const execute = async () => {
    setIsExecuting(true)
    try {
      const result = await operationService.execute(objectName, name, argValues)
      setIsFailed(false)
      setResult(result)
    } catch (err) {
      setIsFailed(true)
      setResult(String(err))
    } finally {
      setIsExecuting(false)
    }
  }

  // TODO: impl HTML escaping
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isResultHtml = () => {
    if (!result) {
      return false
    }
    return result.startsWith('<!DOCTYPE html>') || /^<table[^>]*>/.test(result) || /^<ul[^>]*>/.test(result)
  }

  const argFormInput = (javaType: string, index: number) => {
    const id = `operation-${name}-form-log-buffer-input`
    const value = argValues[index]
    switch (javaType) {
      case 'boolean':
      case 'java.lang.Boolean':
        return <Checkbox id={id} isChecked={Boolean(value)} onChange={updateArgValues(index)} />
      case 'int':
      case 'long':
      case 'java.lang.Integer':
      case 'java.lang.Long':
        return <TextInput id={id} type='number' value={Number(value)} onChange={updateArgValues(index)} />
      default:
        return <TextInput id={id} type='text' value={String(value)} onChange={updateArgValues(index)} />
    }
  }

  const argForms = operation.args.map((arg, index) => (
    <FormGroup
      key={arg.name}
      label={arg.name}
      fieldId={`operation-${name}-form-${arg.name}`}
      helperText={arg.helpText()}
    >
      {argFormInput(arg.type, index)}
    </FormGroup>
  ))

  const OperationExecuteForm = () => (
    <Form isHorizontal={operation.args.length > 0}>
      {operation.args.length === 0 && (
        <Text component='p'>
          This JMX operation requires no arguments. Click the <code>Execute</code> button to invoke the operation.
        </Text>
      )}
      {operation.args.length > 0 && (
        <Text component='p'>
          This JMX operation requires some parameters. Fill in the fields below and click the <code>Execute</code>{' '}
          button to invoke the operation.
        </Text>
      )}
      {argForms}
      <ActionGroup>
        <Button
          key={`operation-action-execute-${name}`}
          variant='primary'
          onClick={execute}
          isSmall
          isDisabled={isExecuting}
        >
          Execute
        </Button>
      </ActionGroup>
    </Form>
  )

  const OperationExecuteResult = () => (
    <React.Fragment>
      <Title headingLevel='h4'>Result</Title>
      <ClipboardCopy
        variant={ClipboardCopyVariant.expansion}
        isExpanded
        isCode
        isReadOnly
        removeFindDomNode
        className={isFailed ? 'jmx-operation-error' : ''}
      >
        {result}
      </ClipboardCopy>
    </React.Fragment>
  )

  return (
    <React.Fragment>
      <DataListContent id={`operation-execute-${name}`} aria-label={`operation execute ${name}`} isHidden={!isExpanded}>
        <OperationExecuteForm />
      </DataListContent>
      {result && (
        <DataListContent id={`operation-result-${name}`} aria-label={`operation result ${name}`} isHidden={!isExpanded}>
          <OperationExecuteResult />
        </DataListContent>
      )}
    </React.Fragment>
  )
}
