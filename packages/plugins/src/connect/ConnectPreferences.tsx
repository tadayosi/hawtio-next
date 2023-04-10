import {
  Alert,
  Button,
  CardBody,
  Checkbox,
  Form,
  FormGroup,
  FormSection,
  Modal,
  ModalVariant,
  TextInput,
} from '@patternfly/react-core'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jolokiaService } from '../connect/jolokia-service'
import { RESET } from './connections'
import { useConnections } from './context'
import { log } from './globals'

export const ConnectPreferences: React.FunctionComponent = () => (
  <CardBody>
    <Form isHorizontal>
      <JolokiaForm />
      <ResetForm />
    </Form>
  </CardBody>
)

const JolokiaForm: React.FunctionComponent = () => {
  const navigate = useNavigate()

  const jolokiaStoredOptions = jolokiaService.loadJolokiaStoredOptions()
  const [updateRate, setUpdateRate] = useState(jolokiaService.loadUpdateRate())
  const [autoRefresh, setAutoRefresh] = useState(jolokiaService.loadAutoRefresh())
  const [maxDepth, setMaxDepth] = useState(jolokiaStoredOptions.maxDepth)
  const [maxCollectionSize, setMaxCollectionSize] = useState(jolokiaStoredOptions.maxCollectionSize)

  const onUpdateRateChanged = (updateRate: string) => {
    const intValue = parseInt(updateRate)

    if (intValue) {
      jolokiaService.saveUpdateRate(intValue)
      setUpdateRate(intValue)
    }
  }

  const onMaxDepthChanged = (maxDepth: string) => {
    const intValue = parseInt(maxDepth)

    if (intValue) {
      jolokiaService.saveJolokiaStoredOptions({ maxDepth: intValue, maxCollectionSize })
      setMaxDepth(intValue)
    }
  }

  const onAutoRefreshChanged = (autoRefresh: boolean) => {
    jolokiaService.saveAutoRefresh(autoRefresh)
    setAutoRefresh(autoRefresh)
  }

  const onMaxCollectionSizeChanged = (maxCollectionSize: string) => {
    const intValue = parseInt(maxCollectionSize)

    if (intValue) {
      jolokiaService.saveJolokiaStoredOptions({ maxDepth, maxCollectionSize: intValue })
      setMaxCollectionSize(intValue)
    }
  }

  const applyJolokia = () => {
    // Page reload will apply currently stored preferences into Jolokia
    navigate(0)
  }

  return (
    <FormSection title='Jolokia' titleElement='h2'>
      <FormGroup label='Update rate' fieldId='jolokia-form-update-rate'>
        <TextInput
          id='jolokia-form-update-rate-input'
          type='number'
          value={updateRate}
          onChange={onUpdateRateChanged}
        />
      </FormGroup>
      <FormGroup label='Max depth' fieldId='jolokia-form-max-depth'>
        <TextInput id='jolokia-form-max-depth-input' type='number' value={maxDepth} onChange={onMaxDepthChanged} />
      </FormGroup>
      <FormGroup label='Max collection size' fieldId='jolokia-form-max-collection-size'>
        <TextInput
          id='jolokia-form-max-collection-size-input'
          type='number'
          value={maxCollectionSize}
          onChange={onMaxCollectionSizeChanged}
        />
      </FormGroup>
      <FormGroup label='Auto refresh' fieldId='jolokia-form-auto-refresh'>
        <Checkbox id='jolokia-form-auto-refresh-input' isChecked={autoRefresh} onChange={onAutoRefreshChanged} />
      </FormGroup>
      <FormGroup fieldId='jolokia-form-apply' helperText='Restart Hawtio with the new values in effect.'>
        <Button onClick={applyJolokia}>Apply</Button>
      </FormGroup>
    </FormSection>
  )
}

const ResetForm: React.FunctionComponent = () => {
  const { dispatch } = useConnections()
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isClearSuccess, setIsClearSuccess] = useState(false)

  const clear = () => {
    log.debug('Clear saved connections')
    dispatch({ type: RESET })
    setIsClearSuccess(true)
    setIsConfirmModalOpen(false)
  }

  const confirmClear = () => {
    setIsConfirmModalOpen(!isConfirmModalOpen)
  }

  const ConfirmClearModal = () => (
    <Modal
      variant={ModalVariant.small}
      title='Clear saved connections'
      titleIconVariant='danger'
      isOpen={isConfirmModalOpen}
      onClose={confirmClear}
      actions={[
        <Button key='reset' variant='danger' onClick={clear}>
          Clear
        </Button>,
        <Button key='cancel' variant='link' onClick={confirmClear}>
          Cancel
        </Button>,
      ]}
    >
      You are about to clear all saved connection settings.
    </Modal>
  )

  return (
    <FormSection title='Reset' titleElement='h2'>
      <FormGroup
        label='Clear saved connections'
        fieldId='reset-form-clear'
        helperText='Clear all saved connection settings stored in your browser local storage.'
      >
        <Button variant='danger' onClick={confirmClear}>
          Clear
        </Button>
        <ConfirmClearModal />
      </FormGroup>
      {isClearSuccess && <Alert variant='success' isInline title='Connections cleared successfully!' />}
    </FormSection>
  )
}
