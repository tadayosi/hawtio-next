import { connectService } from '@hawtiosrc/plugins/shared/connect-service'
import { jolokiaService } from '@hawtiosrc/plugins/shared/jolokia-service'
import { TooltipHelpIcon } from '@hawtiosrc/ui/icons'
import {
  Alert,
  Button,
  CardBody,
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  FormSection,
  HelperText,
  HelperTextItem,
  TextInput,
} from '@patternfly/react-core'
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated'
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RESET } from './connections'
import { useConnections } from './context'
import { log } from './globals'

export const ConnectPreferences: React.FunctionComponent = () => (
  <CardBody>
    <Form isHorizontal>
      <JolokiaForm />
      <ConnectionForm />
      <ResetForm />
    </Form>
  </CardBody>
)
const ValidatedHelperText: React.FunctionComponent<{
  validated: 'default' | 'error' | 'success' | 'warning' | 'indeterminate' | undefined
  errorText: string
}> = ({ validated, errorText }) => {
  return (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant={validated} {...(validated === 'error' && { icon: <ExclamationCircleIcon /> })}>
          {validated === 'error' && errorText}
        </HelperTextItem>
      </HelperText>
    </FormHelperText>
  )
}
type ValidatedType = 'default' | 'error' | 'success' | 'warning' | undefined
const JolokiaForm: React.FunctionComponent = () => {
  const navigate = useNavigate()

  const jolokiaStoredOptions = jolokiaService.loadJolokiaStoredOptions()
  const [updateRate, setUpdateRate] = useState(jolokiaService.loadUpdateRate())
  const [updateRateValidated, setUpdateRateValidated] = useState<ValidatedType>('default')
  const [updateRateInvalidText, setUpdateRateInvalidText] = useState('')
  const [maxDepth, setMaxDepth] = useState(jolokiaStoredOptions.maxDepth)
  const [maxDepthValidated, setMaxDepthValidated] = useState<ValidatedType>('default')
  const [maxDepthInvalidText, setMaxDepthInvalidText] = useState('')
  const [maxCollectionSize, setMaxCollectionSize] = useState(jolokiaStoredOptions.maxCollectionSize)
  const [maxCollectionSizeValidated, setMaxCollectionSizeValidated] = useState<ValidatedType>('default')
  const [maxCollectionSizeInvalidText, setMaxCollectionSizeInvalidText] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(jolokiaService.loadAutoRefresh())

  const onUpdateRateChanged = (updateRate: string) => {
    const intValue = parseInt(updateRate)
    if (!intValue) {
      setUpdateRateValidated('error')
      setUpdateRateInvalidText('Must be a number')
      return
    }
    if (intValue <= 0) {
      setUpdateRateValidated('error')
      setUpdateRateInvalidText('Must be greater than 0')
      return
    }

    setUpdateRate(intValue)
    setUpdateRateValidated('success')
  }

  const onMaxDepthChanged = (maxDepth: string) => {
    const intValue = parseInt(maxDepth)
    if (!intValue) {
      setMaxDepthValidated('error')
      setMaxDepthInvalidText('Must be a number')
      return
    }
    if (intValue <= 0) {
      setMaxDepthValidated('error')
      setMaxDepthInvalidText('Must be greater than 0')
      return
    }

    setMaxDepth(intValue)
    setMaxDepthValidated('success')
  }

  const onMaxCollectionSizeChanged = (maxCollectionSize: string) => {
    const intValue = parseInt(maxCollectionSize)
    if (!intValue) {
      setMaxCollectionSizeValidated('error')
      setMaxCollectionSizeInvalidText('Must be a number')
      return
    }
    if (intValue <= 0) {
      setMaxCollectionSizeValidated('error')
      setMaxCollectionSizeInvalidText('Must be greater than 0')
      return
    }

    setMaxCollectionSize(intValue)
    setMaxCollectionSizeValidated('success')
  }

  const onAutoRefreshChanged = (autoRefresh: boolean) => {
    setAutoRefresh(autoRefresh)
  }

  const applyJolokia = () => {
    jolokiaService.saveUpdateRate(updateRate)
    jolokiaService.saveJolokiaStoredOptions({ maxDepth, maxCollectionSize })
    jolokiaService.saveAutoRefresh(autoRefresh)

    // Page reload will apply currently stored preferences into Jolokia
    navigate(0)
  }

  return (
    <FormSection title='Jolokia' titleElement='h2'>
      <FormGroup
        label='Update rate'
        fieldId='jolokia-form-update-rate'
        labelHelp={<TooltipHelpIcon tooltip='The period between polls to jolokia to fetch JMX data' />}
      >
        <TextInput
          id='jolokia-form-update-rate-input'
          type='number'
          value={updateRate}
          validated={updateRateValidated}
          onChange={(_event, updateRate: string) => onUpdateRateChanged(updateRate)}
        />
        <ValidatedHelperText validated={updateRateValidated} errorText={updateRateInvalidText} />
      </FormGroup>
      <FormGroup
        label='Max depth'
        fieldId='jolokia-form-max-depth'
        labelHelp={
          <TooltipHelpIcon tooltip='The number of levels jolokia will marshal an object to json on the server side before returning' />
        }
      >
        <TextInput
          id='jolokia-form-max-depth-input'
          type='number'
          value={maxDepth}
          validated={maxDepthValidated}
          onChange={(_event, maxDepth: string) => onMaxDepthChanged(maxDepth)}
        />
        <ValidatedHelperText validated={maxDepthValidated} errorText={maxDepthInvalidText} />
      </FormGroup>
      <FormGroup
        label='Max collection size'
        fieldId='jolokia-form-max-collection-size'
        labelHelp={
          <TooltipHelpIcon tooltip='The maximum number of elements in an array that jolokia will marshal in a response' />
        }
      >
        <TextInput
          id='jolokia-form-max-collection-size-input'
          type='number'
          value={maxCollectionSize}
          validated={maxCollectionSizeValidated}
          onChange={(_event, maxCollectionSize: string) => onMaxCollectionSizeChanged(maxCollectionSize)}
        />
        <ValidatedHelperText validated={maxCollectionSizeValidated} errorText={maxCollectionSizeInvalidText} />
      </FormGroup>
      <FormGroup
        label='Auto refresh'
        fieldId='jolokia-form-auto-refresh'
        labelHelp={
          <TooltipHelpIcon tooltip='Whether the page should refresh whenever it detects an update on a plugin' />
        }
      >
        <Checkbox
          id='jolokia-form-auto-refresh-input'
          isChecked={autoRefresh}
          onChange={(_event, autoRefresh: boolean) => onAutoRefreshChanged(autoRefresh)}
        />
      </FormGroup>
      <FormGroup fieldId='jolokia-form-apply'>
        <Button data-testid='apply-jolokia' onClick={applyJolokia}>
          Apply
        </Button>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Restart Hawtio with the new values in effect.</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
    </FormSection>
  )
}

const ConnectionForm: React.FunctionComponent = () => {
  const navigate = useNavigate()
  const [useConnectionParam, setUseConnectionParam] = useState(connectService.loadUseConnectionParam() ?? false)

  const applyConnection = () => {
    connectService.saveUseConnectionParam(useConnectionParam)
    navigate(0)
  }

  return (
    <FormSection title='Connection' titleElement='h2'>
      <FormGroup
        label='Keep connection parameter'
        fieldId='connection-form-use-connection-param'
        labelIcon={
          <TooltipHelpIcon tooltip='Whether to keep the connection (con) query parameter in the URL after connecting to a remote instance' />
        }
      >
        <Checkbox
          id='connection-form-use-connection-param-input'
          isChecked={useConnectionParam}
          onChange={(_event, useConnectionParam: boolean) => setUseConnectionParam(useConnectionParam)}
        />
      </FormGroup>
      <FormGroup fieldId='connection-form-apply'>
        <Button data-testid='apply-connection' onClick={applyConnection}>
          Apply
        </Button>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Restart Hawtio with the new connection settings in effect.</HelperTextItem>
          </HelperText>
        </FormHelperText>
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
      data-testid='clear-connections-modal'
      variant={ModalVariant.small}
      title='Clear saved connections'
      titleIconVariant='danger'
      isOpen={isConfirmModalOpen}
      onClose={confirmClear}
      actions={[
        <Button key='reset' data-testid='clear-btn' variant='danger' onClick={clear}>
          Clear
        </Button>,
        <Button key='cancel' data-testid='cancel-btn' variant='link' onClick={confirmClear}>
          Cancel
        </Button>,
      ]}
    >
      You are about to clear all saved connection settings.
    </Modal>
  )

  return (
    <FormSection title='Reset' titleElement='h2'>
      <FormGroup label='Clear saved connections' fieldId='reset-form-clear'>
        <Button data-testid='clear-btn' variant='danger' onClick={confirmClear}>
          Clear
        </Button>
        <ConfirmClearModal />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Clear all saved connection settings stored in your browser local storage.</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
      {isClearSuccess && <Alert variant='success' isInline title='Connections cleared successfully!' />}
    </FormSection>
  )
}
