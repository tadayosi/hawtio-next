import { eventService } from '@hawtiosrc/core'
import { PluginNodeSelectionContext } from '@hawtiosrc/plugins/context'
import {
  ActionGroup,
  Alert,
  Button,
  Card,
  CardBody,
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
  DropdownList,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  Content,
  TextInput,
  Title,
} from '@patternfly/react-core'
import { LockIcon } from '@patternfly/react-icons/dist/esm/icons/lock-icon'
import React, { createContext, useContext, useState } from 'react'
import './OperationForm.css'
import { Operation, OperationArgument } from './operation'
import { operationService } from './operation-service'
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon'
import DOMPurify from 'dompurify'

export const OperationContext = createContext<{
  name: string
  operation: Operation
  objectName: string
}>({
  name: '',
  operation: new Operation('', [], '', ''),
  objectName: '',
})

export const OperationForm: React.FunctionComponent<{
  name: string
  operation: Operation
}> = ({ name, operation }) => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)
  const [isExpanded, setIsExpanded] = useState(false)

  if (!selectedNode || !selectedNode.objectName || !selectedNode.mbean) {
    return null
  }

  const { objectName } = selectedNode

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  const operationCells = [
    <DataListCell key={`operation-cell-name-${name}`} isFilled={false}>
      <code className='operation-datatype'>{operation.readableReturnType}</code>
      <b>{operation.readableName}</b>
    </DataListCell>,
    <DataListCell key={`operation-cell-desc-${name}`} isFilled={false}>
      {operation.description}
    </DataListCell>,
  ]
  // Lock if it's not invocable
  if (!operation.canInvoke) {
    operationCells.unshift(
      <DataListCell key={`operation-cell-icon-${name}`} isIcon isFilled={false}>
        <LockIcon />
      </DataListCell>,
    )
  }

  return (
    <OperationContext.Provider value={{ name, operation, objectName }}>
      <DataListItem key={`operation-${name}`} aria-labelledby={`operation ${name}`} isExpanded={isExpanded}>
        <DataListItemRow>
          <DataListToggle onClick={handleToggle} isExpanded={isExpanded} id='ex-toggle1' aria-controls='ex-expand1' />
          <DataListItemCells dataListCells={operationCells} />
          <OperationActions />
        </DataListItemRow>
        <OperationFormContents isExpanded={isExpanded} />
      </DataListItem>
    </OperationContext.Provider>
  )
}

const insecureContextMsg =
  'Because Hawtio is accessed through insecure context (http:), it is not possible to copy data into the clipboard.'

const InsecureContextWarning: React.FunctionComponent = () => {
  return (
    <Alert title='Insecure context limits functionality' variant='warning'>
      {insecureContextMsg}
    </Alert>
  )
}

const OperationActions: React.FunctionComponent = () => {
  const { name, operation, objectName } = useContext(OperationContext)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const notifySuccessfulCopy = () => {
    eventService.notify({
      type: 'success',
      message: 'Copied to clipboard',
    })
  }

  const notifyCopyFailure = (text: string) => {
    eventService.notify({
      type: 'warning',
      message: (
        <>
          <p>{insecureContextMsg}</p>
          <p>
            You can copy the URL manually: <code>{text}</code>
          </p>
        </>
      ),
      duration: 10_000,
    })
  }

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text)
      notifySuccessfulCopy()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      notifyCopyFailure(text)
    }
  }

  const copyMethodName = () => {
    copyToClipboard(operation.readableName)
  }

  const copyJolokiaURL = async () => {
    copyToClipboard(await operationService.getJolokiaUrl(objectName, name))
  }

  return (
    <DataListAction
      id={`operation-actions-${name}`}
      aria-label={`operation actions ${name}`}
      aria-labelledby={`${name} operation-actions-${name}`}
    >
      <Dropdown
        key={`operation-action-dropdown-${name}`}
        popperProps={{ position: 'right' }}
        isOpen={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle variant='plain' ref={toggleRef} onClick={handleDropdownToggle}>
            <EllipsisVIcon />
          </MenuToggle>
        )}
      >
        <DropdownList>
          {!isSecureContext && <InsecureContextWarning />}
          <DropdownItem key={`operation-action-copy-method-name-${name}`} onClick={copyMethodName}>
            Copy method name
          </DropdownItem>
          <DropdownItem key={`operation-action-copy-jolokia-url-${name}`} onClick={copyJolokiaURL}>
            Copy Jolokia URL
          </DropdownItem>
        </DropdownList>
      </Dropdown>
    </DataListAction>
  )
}

const sanitizeHTML = (rawHtml: string) => {
  return DOMPurify.sanitize(rawHtml)
}

const OperationExecuteResult: React.FunctionComponent<{
  isResultHtml: () => boolean
  isRenderHtmlMode: boolean
  isFailed: boolean
  setIsRenderHtmlMode: React.Dispatch<React.SetStateAction<boolean>>
  result?: string
}> = ({ isResultHtml, isRenderHtmlMode, isFailed, setIsRenderHtmlMode, result }) => (
  <React.Fragment>
    <Flex>
      <FlexItem>
        <Title headingLevel='h4'>Result</Title>
      </FlexItem>

      {isResultHtml() && (
        <FlexItem>
          <Button variant='secondary' onClick={() => setIsRenderHtmlMode(!isRenderHtmlMode)}>
            {isRenderHtmlMode ? 'Raw View' : 'Render HTML'}
          </Button>
        </FlexItem>
      )}
    </Flex>

    {isRenderHtmlMode && isResultHtml() ? (
      <Card>
        <CardBody>
          <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(result!) }} />
        </CardBody>
      </Card>
    ) : (
      <ClipboardCopy
        variant={ClipboardCopyVariant.expansion}
        isExpanded
        isCode
        isReadOnly
        className={isFailed ? 'jmx-operation-error' : ''}
      >
        {result ?? ''}
      </ClipboardCopy>
    )}
  </React.Fragment>
)

const OperationFormContents: React.FunctionComponent<{ isExpanded: boolean }> = ({ isExpanded }) => {
  const { name } = useContext(OperationContext)
  const [isFailed, setIsFailed] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [isRenderHtmlMode, setIsRenderHtmlMode] = useState(true)

  const isResultHtml = () => {
    if (!result) {
      return false
    }
    return result.startsWith('<!DOCTYPE html>') || /^<table[^>]*>/.test(result) || /^<ul[^>]*>/.test(result)
  }

  return (
    <React.Fragment>
      <DataListContent id={`operation-execute-${name}`} aria-label={`operation execute ${name}`} isHidden={!isExpanded}>
        <OperationExecuteForm setResult={setResult} setIsFailed={setIsFailed} />
      </DataListContent>
      {result && (
        <DataListContent id={`operation-result-${name}`} aria-label={`operation result ${name}`} isHidden={!isExpanded}>
          <OperationExecuteResult
            result={result}
            isFailed={isFailed}
            isResultHtml={isResultHtml}
            isRenderHtmlMode={isRenderHtmlMode}
            setIsRenderHtmlMode={setIsRenderHtmlMode}
          />
        </DataListContent>
      )}
    </React.Fragment>
  )
}

function defaultValue(javaType: string): unknown {
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

const OperationExecuteForm: React.FunctionComponent<{
  setResult: (result: string) => void
  setIsFailed: (failed: boolean) => void
}> = ({ setResult, setIsFailed }) => {
  const { name, operation, objectName } = useContext(OperationContext)
  const [isExecuting, setIsExecuting] = useState(false)

  const [argValues, setArgValues] = useState<unknown[]>(operation.args.map(arg => defaultValue(arg.type)))

  const updateArgValues = (index: number) => (_event: React.FormEvent<HTMLInputElement>, value: boolean | string) => {
    const values = [...argValues]
    values[index] = value
    setArgValues(values)
  }

  const processResult = (result: unknown) => {
    if (operation.returnType === 'void' && (!result || result === 'null')) {
      return 'Operation successful'
    }
    switch (typeof result) {
      case 'boolean':
        return result.toString()
      case 'string': {
        const trimmed = result.trim()
        if (trimmed === '') {
          return 'Empty string'
        }
        return trimmed
      }
      default:
        return JSON.stringify(result, null, 2)
    }
  }

  const execute = async () => {
    if (!operation.canInvoke) {
      return
    }
    setIsExecuting(true)
    try {
      const result = await operationService.execute(objectName, name, argValues)
      setIsFailed(false)
      setResult(processResult(result))
    } catch (err) {
      setIsFailed(true)
      setResult(String(err))
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <Form
      isHorizontal={operation.args.length > 0}
      onSubmit={event => {
        event.preventDefault()
        execute()
      }}
    >
      {operation.args.length === 0 && (
        <Content component='p'>
          This JMX operation requires no arguments. Click the <code>Execute</code> button to invoke the operation.
        </Content>
      )}
      {operation.args.length > 0 && (
        <Content component='p'>
          This JMX operation requires some parameters. Fill in the fields below and click the <code>Execute</code>{' '}
          button to invoke the operation.
        </Content>
      )}
      {operation.args.map((arg, index) => (
        <FormGroup
          key={`operation-${name}-form-${arg.name}-${index}`}
          label={arg.name}
          fieldId={`operation-${name}-form-${arg.name}-${index}`}
        >
          <ArgFormInput
            key={`operation-${name}-arg-form-${arg.name}-${index}`}
            opName={name}
            arg={arg}
            index={index}
            canInvoke={operation.canInvoke}
            argValues={argValues}
            updateArgValues={updateArgValues}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{arg.helpText()}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      ))}
      <ActionGroup>
        <Button
          key={`operation-action-execute-${name}`}
          variant='danger'
          onClick={execute}
          type='submit'
          size='sm'
          isDisabled={!operation.canInvoke || isExecuting}
        >
          Execute
        </Button>
      </ActionGroup>
    </Form>
  )
}

const ArgFormInput: React.FunctionComponent<{
  opName: string
  arg: OperationArgument
  index: number
  canInvoke: boolean
  argValues: unknown[]
  updateArgValues: (index: number) => (event: React.FormEvent<HTMLInputElement>, value: boolean | string) => void
}> = ({ opName, arg, index, canInvoke, argValues, updateArgValues }) => {
  const id = `operation-${opName}-arg-form-input-${arg.name}-${index}`
  const value = argValues[index]
  switch (arg.type) {
    case 'boolean':
    case 'java.lang.Boolean':
      return <Checkbox id={id} isChecked={Boolean(value)} onChange={updateArgValues(index)} isDisabled={!canInvoke} />
    case 'int':
    case 'long':
    case 'java.lang.Integer':
    case 'java.lang.Long':
      return (
        <TextInput
          id={id}
          type='number'
          value={Number(value)}
          onChange={updateArgValues(index)}
          isDisabled={!canInvoke}
        />
      )

    default:
      return (
        <TextInput
          id={id}
          type='text'
          value={String(value)}
          onChange={updateArgValues(index)}
          isDisabled={!canInvoke}
        />
      )
  }
}
