import {
  ActionGroup,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSection,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core'
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon'
import React, { useContext, useEffect, useState } from 'react'
import { CamelContext } from '../context'
import { EndpointParametersForm } from './EndpointParametersForm'
import { AddEndpointContext } from './context'
import * as es from './endpoints-service'

const placeholder = 'Select Component Name'

export const AddEndpointWizard: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const ctx = useContext(AddEndpointContext)
  const { componentName, setComponentSchema } = ctx
  const [isOpen, setIsOpen] = useState(false)
  const [endpointValidated, setEndpointValidated] = useState<'success' | 'error' | 'default'>('default')

  useEffect(() => {
    if (!selectedNode || !componentName) return

    es.loadEndpointSchema(selectedNode, componentName).then(schema => {
      if (schema) {
        setComponentSchema(schema)
      }
    })
  }, [selectedNode, componentName, setComponentSchema])

  if (!selectedNode) {
    return null
  }

  const onToggle = (isOpen: boolean) => {
    setIsOpen(isOpen)
  }

  const onSelect = (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
    if (placeholder === value) return

    ctx.setComponentName(value as string)
    setIsOpen(false)
  }

  const onEndpointPathChanged = (value: string) => {
    ctx.setEndpointPath(value)

    const invalid = !value || value.length === 0 || !/^[a-zA-Z\d-_/:]+$/.test(value)
    setEndpointValidated(invalid ? 'error' : 'success')
  }

  const endpointInvalidMessage = (): string => {
    if (!ctx.endpointPath || ctx.endpointPath.length === 0) return 'Endpoint path is empty.'

    return 'Endpoint path invalid. Only alphanumeric characters, underscore, and hyphen allowed'
  }

  const onCancelClicked = () => {
    ctx.showAddEndpoint(false)
  }

  const onSubmitClicked = () => {
    es.createEndpointFromData(selectedNode, ctx.componentName, ctx.endpointPath, ctx.endpointParameters)
    ctx.showAddEndpoint(false)
  }

  return (
    <Form isHorizontal>
      <FormGroup label='Component' isRequired fieldId='form-component-name'>
        <Select
          aria-label={placeholder}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle ref={toggleRef} onClick={() => onToggle(!isOpen)}>
              {placeholder}
            </MenuToggle>
          )}
          onSelect={onSelect}
          onOpenChange={setIsOpen}
          selected={ctx.componentName}
          isOpen={isOpen}
        >
          <SelectList>
            {ctx.componentNames?.map((name, index) => (
              <SelectOption key={index} value={name}>
                {name}
              </SelectOption>
            )) ?? []}
          </SelectList>
        </Select>
      </FormGroup>
      {ctx.componentName && (
        <React.Fragment>
          <FormGroup label='Endpoint Path' fieldId='endpoint-path'>
            <TextInput
              id='endpoint-path-input'
              type='text'
              value={ctx.endpointPath}
              isRequired={true}
              onChange={(_event, value: string) => onEndpointPathChanged(value)}
              validated={endpointValidated}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem
                  variant={endpointValidated}
                  {...(endpointValidated === 'error' && { icon: <ExclamationCircleIcon /> })}
                >
                  {endpointInvalidMessage()}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          {ctx.componentSchema && (
            <FormSection title='Endpoint Parameters'>
              <EndpointParametersForm />
            </FormSection>
          )}
        </React.Fragment>
      )}
      <ActionGroup>
        <Button
          variant='primary'
          isDisabled={!ctx.endpointPath || ctx.endpointPath.length === 0 || endpointValidated !== 'success'}
          onClick={onSubmitClicked}
        >
          Submit
        </Button>
        <Button variant='link' onClick={onCancelClicked}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  )
}
