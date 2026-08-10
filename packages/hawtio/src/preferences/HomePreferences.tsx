import { hawtio, uiTheme, useHawtconfig } from '@hawtiosrc/core'
import { HawtioLoadingPage } from '@hawtiosrc/ui'
import {
  Alert,
  Button,
  CardBody,
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
  Switch,
} from '@patternfly/react-core'
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated'
import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { preferencesService } from './preferences-service'

export const HomePreferences: React.FunctionComponent = () => {
  const { hawtconfig, hawtconfigLoaded } = useHawtconfig()

  if (!hawtconfigLoaded) return <HawtioLoadingPage />

  const sideBarShown = hawtconfig.appearance?.showSideBar ?? true

  return (
    <CardBody>
      <Form isHorizontal>
        {sideBarShown && (
          <FormSection title='UI' titleElement='h2'>
            <UIForm />
          </FormSection>
        )}
        <FormSection title='Reset' titleElement='h2'>
          <ResetForm />
        </FormSection>
      </Form>
    </CardBody>
  )
}

function themeName(theme: uiTheme): string {
  switch (theme) {
    case uiTheme.BROWSER:
      return 'Default Browser theme'
    case uiTheme.DARK:
      return 'Dark theme'
    default:
      return 'Light theme'
  }
}

const UIForm: React.FunctionComponent = () => {
  const [showVerticalNav, setShowVerticalNav] = useState(preferencesService.isShowVerticalNavByDefault())
  const [theme, setTheme] = useState<uiTheme>(hawtio.currentTheme())
  const [themeLabelOpen, setThemeLabelOpen] = useState(false)

  const handleShowVerticalNavChange = (value: boolean) => {
    setShowVerticalNav(value)
    preferencesService.saveShowVerticalNavByDefault(value)
  }

  const selectTheme = (_event?: React.MouseEvent<Element, MouseEvent>, value?: uiTheme) => {
    if (value === uiTheme.BROWSER) {
      // get back to browser default
      hawtio.updateFromTheme()
      localStorage.removeItem('hawtio.theme')
    } else {
      // override the theme
      const mode = value === uiTheme.DARK ? 'dark' : 'light'
      hawtio.updateFromPreferences(mode)
      localStorage.setItem('hawtio.theme', mode)
    }
    setTheme(value as typeof theme)
    setThemeLabelOpen(!themeLabelOpen)
  }

  return (
    <>
      <FormGroup label='Default vertical nav state' fieldId='ui-form-vertical-nav-switch'>
        <Switch
          data-testid='switch-vertical-nav-state'
          label='Show vertical navigation'
          isChecked={showVerticalNav}
          onChange={(_event, value: boolean) => handleShowVerticalNavChange(value)}
        />
      </FormGroup>
      <FormGroup label='UI Theme' fieldId='ui-form-vertical-nav-switch'>
        <Select
          selected={theme}
          isOpen={themeLabelOpen}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle ref={toggleRef} onClick={() => setThemeLabelOpen(!themeLabelOpen)}>
              {themeName(theme)}
            </MenuToggle>
          )}
          onSelect={selectTheme}
        >
          <SelectList>
            <SelectOption key='theme-browser' value={uiTheme.BROWSER}>
              Default Browser theme
            </SelectOption>
            <SelectOption key='theme-light' value={uiTheme.LIGHT}>
              Light theme
            </SelectOption>
            <SelectOption key='theme-dark' value={uiTheme.DARK}>
              Dark theme
            </SelectOption>
          </SelectList>
        </Select>
      </FormGroup>
    </>
  )
}

const ResetForm: React.FunctionComponent = () => {
  const navigate = useNavigate()
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false)

  const reset = () => {
    preferencesService.reset()
    // Reload page after reset
    navigate(0)
  }

  const confirmReset = () => {
    setIsConfirmResetOpen(!isConfirmResetOpen)
  }

  const ConfirmResetModal = () => (
    <Modal
      data-testid='reset-settings-modal'
      variant={ModalVariant.small}
      title='Reset settings'
      titleIconVariant='danger'
      isOpen={isConfirmResetOpen}
      onClose={confirmReset}
      actions={[
        <Button key='reset' data-testid='reset-btn' variant='danger' onClick={reset}>
          Reset
        </Button>,
        <Button key='cancel' data-testid='cancel-btn' variant='link' onClick={confirmReset}>
          Cancel
        </Button>,
      ]}
    >
      You are about to reset all the Hawtio settings.
    </Modal>
  )

  const resetSuccess = preferencesService.isResetSuccess()

  return (
    <React.Fragment>
      <FormGroup label='Reset settings' fieldId='reset-form-reset'>
        <Button data-testid='reset-btn' variant='danger' onClick={confirmReset}>
          Reset
        </Button>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              Clear all custom settings stored in your browser`s local storage and reset to defaults.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
        <ConfirmResetModal />
      </FormGroup>
      {resetSuccess && <Alert variant='success' isInline title='Settings reset successfully!' />}
    </React.Fragment>
  )
}
