import { PluginNodeSelectionContext } from '@hawtiosrc/plugins/context'
import {
  Button,
  ClipboardCopy,
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Form,
  FormGroup,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core'
import React, { useContext, useEffect, useState } from 'react'
import { attributeService } from './attribute-service'
import { log } from '../globals'
import { eventService } from '@hawtiosrc/core'

export const AttributeModal: React.FunctionComponent<{
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  input: { name: string; value: string }
}> = ({ isOpen, onClose, onUpdate, input }) => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)
  const attributeName = input.name
  const [attributeValue, setAttributeValue] = useState('')
  const [jolokiaUrl, setJolokiaUrl] = useState('Loading...')
  const [isWritable, setIsWritable] = useState(false)

  useEffect(() => {
    if (!selectedNode || !selectedNode.objectName || !selectedNode.mbean) {
      return
    }

    const { mbean, objectName } = selectedNode

    const attribute = mbean.attr?.[attributeName]
    if (!attribute) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttributeValue(input.value)

    // Update Jolokia URL
    const buildUrl = async () => {
      const url = await attributeService.buildUrl(objectName, attributeName)
      setJolokiaUrl(url)
    }
    buildUrl()

    // Check RBAC on the selected attribute
    if (attribute.rw) {
      // For writable attribute, we need to check RBAC
      const canInvoke = async () => {
        const canInvoke = await attributeService.canInvoke(objectName, attributeName, attribute.type)
        log.debug('Attribute', attributeName, 'canInvoke:', canInvoke)
        setIsWritable(canInvoke)
      }
      canInvoke()
    } else {
      setIsWritable(false)
    }
  }, [selectedNode, attributeName, input])

  if (!selectedNode || !selectedNode.objectName || !selectedNode.mbean) {
    return null
  }

  const { mbean, objectName } = selectedNode

  const attribute = mbean.attr?.[attributeName]
  if (!attribute) {
    return null
  }

  const updateAttribute = async () => {
    if (attributeValue === input.value) {
      eventService.notify({ type: 'info', message: 'The attribute value has not changed' })
    } else {
      await attributeService.update(objectName, attributeName, attributeValue)
      onUpdate()
    }
    onClose()
  }

  const modalTitle = `Attribute: ${attributeName}`

  const modalActions = []

  if (isWritable) {
    modalActions.push(
      <Button key='update' variant='danger' onClick={updateAttribute}>
        Save
      </Button>,
    )
  }

  return (
    <DrawerPanelContent isResizable>
      <DrawerHead>
        <Title headingLevel='h2' size='xl'>
          {modalTitle}
        </Title>
        <DrawerActions>
          <DrawerCloseButton onClick={onClose} />
        </DrawerActions>
      </DrawerHead>

      <DrawerPanelBody>
        <Form id='attribute-form' isHorizontal>
          <FormGroup label='Name' fieldId='attribute-form-name'>
            <TextInput
              id='attribute-form-name'
              name='attribute-form-name'
              value={attributeName}
              readOnlyVariant='default'
            />
          </FormGroup>
          <FormGroup label='Description' fieldId='attribute-form-description'>
            <TextArea
              id='attribute-form-description'
              name='attribute-form-description'
              value={attribute.desc}
              readOnlyVariant='default'
            />
          </FormGroup>
          <FormGroup label='Type' fieldId='attribute-form-type'>
            <TextInput
              id='attribute-form-type'
              name='attribute-form-type'
              value={attribute.type}
              readOnlyVariant='default'
            />
          </FormGroup>
          <FormGroup label='Jolokia URL' fieldId='attribute-form-jolokia-url'>
            <ClipboardCopy isReadOnly>{jolokiaUrl}</ClipboardCopy>
          </FormGroup>
          <FormGroup label='Value' fieldId='attribute-form-value'>
            <TextInput
              id='attribute-form-value'
              name='attribute-form-value'
              value={attributeValue}
              onChange={(_event, value) => setAttributeValue(value)}
              readOnlyVariant={isWritable ? undefined : 'default'}
            />
          </FormGroup>
          <FormGroup>{modalActions}</FormGroup>
        </Form>
      </DrawerPanelBody>
    </DrawerPanelContent>
  )
}
