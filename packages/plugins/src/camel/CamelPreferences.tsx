import { CardBody, Checkbox, Form, FormGroup, FormSection, TextInput } from '@patternfly/react-core'
import React, { useState } from 'react'
import { camelPreferencesService, CamelOptions } from './camel-preferences-service'

export const CamelPreferences: React.FunctionComponent = () => (
  <CardBody>
    <Form isHorizontal>
      <CamelPreferencesForm />
    </Form>
  </CardBody>
)

const CamelPreferencesForm: React.FunctionComponent = () => {
  const [camelPreferences, setCamelPreferences] = useState(camelPreferencesService.loadCamelPreferences())

  const updatePreferences = (value: boolean | number, key: keyof CamelOptions): void => {
    const updatedPreferences = { ...camelPreferences, ...{ [key]: value } }

    camelPreferencesService.saveCamelPreferences(updatedPreferences)
    setCamelPreferences(updatedPreferences)
  }

  const updateNumberValueFor = (key: keyof CamelOptions): ((value: string) => void) => {
    //Returning an arrow function to reduce boilerplate
    return (value: string) => {
      const intValue = parseInt(value)

      if (!intValue) return

      updatePreferences(intValue, key)
    }
  }

  const updateCheckboxValueFor = (key: keyof CamelOptions): ((value: boolean, _: React.FormEvent) => void) => {
    //Utility function generator to reduce boilerplate
    return (value: boolean, _: React.FormEvent) => {
      updatePreferences(value, key)
    }
  }

  return (
    <FormSection>
      <FormGroup label='Hide option documentation' fieldId='camel-form-hide-option-documentation'>
        <Checkbox
          id='camel-form-hide-option-documentation'
          isChecked={camelPreferences.isHideOptionDocumentation}
          onChange={updateCheckboxValueFor('isHideOptionDocumentation')}
        />
      </FormGroup>
      <FormGroup label='Hide default options values' fieldId='camel-form-hide-default-option-value'>
        <Checkbox
          id='camel-form-hide-default-option-value'
          isChecked={camelPreferences.isHideDefaultOptionValues}
          onChange={updateCheckboxValueFor('isHideDefaultOptionValues')}
        />
      </FormGroup>
      <FormGroup label='Hide unused options values' fieldId='camel-form-hide-unused-option-value'>
        <Checkbox
          id='camel-form-hide-unused-option-value'
          isChecked={camelPreferences.isHideUnusedOptionValues}
          onChange={updateCheckboxValueFor('isHideUnusedOptionValues')}
        />
      </FormGroup>
      <FormGroup label='Include trace / debug streams' fieldId='camel-form-include-trace-debug-streams'>
        <Checkbox
          id='camel-form-include-trace-debug-streams'
          isChecked={camelPreferences.isIncludeTraceDebugStreams}
          onChange={updateCheckboxValueFor('isIncludeTraceDebugStreams')}
        />
      </FormGroup>
      <FormGroup label='Maximum trace / debug body length' fieldId='camel-form-maximum-trace-debug-body-length'>
        <TextInput
          id='camel-form-maximum-trace-debug-body-length'
          type='number'
          value={camelPreferences.maximumTraceDebugBodyLength}
          onChange={updateNumberValueFor('maximumTraceDebugBodyLength')}
        />
      </FormGroup>
      <FormGroup label='Maximum label width' fieldId='camel-form-maximum-label-width'>
        <TextInput
          id='camel-form-maximum-label-width'
          type='number'
          value={camelPreferences.maximumLabelWidth}
          onChange={updateNumberValueFor('maximumLabelWidth')}
        />
      </FormGroup>
      <FormGroup label='Ignore ID for label' fieldId='camel-form-ignore-id-for-label'>
        <Checkbox
          id='camel-form-ignore-id-for-label'
          isChecked={camelPreferences.isIgnoreIDForLabel}
          onChange={updateCheckboxValueFor('isIgnoreIDForLabel')}
        />
      </FormGroup>
      <FormGroup label='Show inflight counter' fieldId='camel-show-inflight-counter'>
        <Checkbox
          id='camel-show-inflight-counter'
          isChecked={camelPreferences.isShowInflightCounter}
          onChange={updateCheckboxValueFor('isShowInflightCounter')}
        />
      </FormGroup>
      <FormGroup label='Route metric maximum seconds' fieldId='camel-form-route-metric-maximum-seconds'>
        <TextInput
          id='camel-form-route-metric-maximum-seconds'
          type='number'
          value={camelPreferences.routeMetricMaximumSeconds}
          onChange={updateNumberValueFor('routeMetricMaximumSeconds')}
        />
      </FormGroup>
    </FormSection>
  )
}
