import { ChildLogger, Logger } from '@hawtiosrc/core'
import {
  Button,
  CardBody,
  DataList,
  DataListAction,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Dropdown,
  DropdownItem,
  DropdownList,
  Form,
  FormGroup,
  FormSection,
  MenuToggle,
  MenuToggleElement,
  Slider,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core'
import { PlusIcon } from '@patternfly/react-icons/dist/esm/icons/plus-icon'
import { TrashIcon } from '@patternfly/react-icons/dist/esm/icons/trash-icon'
import React, { useContext, useState } from 'react'
import { LogsContext, useChildLoggers } from './context'

const ChildLoggerList: React.FunctionComponent<{
  childLoggers: ChildLogger[]
}> = ({ childLoggers }) => (
    <DataList id='logs-child-logger-list' aria-label='logs child logger list' isCompact>
      {childLoggers.map(childLogger => (
        <ChildLoggerItem key={childLogger.name} logger={childLogger} />
      ))}
    </DataList>
)

export const LogsPreferences: React.FunctionComponent = () => {
  const { childLoggers, availableChildLoggers, reloadChildLoggers } = useChildLoggers()

  return (
    <LogsContext.Provider value={{ childLoggers, availableChildLoggers, reloadChildLoggers }}>
      <CardBody>
        <Form isHorizontal>
          <FormSection title='Global log settings' titleElement='h2'>
            <GlobalForms />
          </FormSection>
          <FormSection title='Child loggers' titleElement='h2'>
            <ChildLoggerToolbar />
            <ChildLoggerList childLoggers={childLoggers} />
          </FormSection>
        </Form>
      </CardBody>
    </LogsContext.Provider>
  )
}

const LOG_LEVEL_OPTIONS = ['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const

const GlobalForms: React.FunctionComponent = () => {
  const [logLevel, setLogLevel] = useState(Logger.getLevel().name)

  const handleLogLevelChange = (level?: string) => {
    if (!level) {
      return
    }
    setLogLevel(level)
    Logger.setLevel(level)
  }

  return (
    <React.Fragment>
      <FormGroup label='Log level' fieldId='logs-global-form-log-level'>
        <Slider
          id='logs-global-form-log-level-slider'
          value={LOG_LEVEL_OPTIONS.findIndex(level => level === logLevel)}
          max={LOG_LEVEL_OPTIONS.length - 1}
          customSteps={LOG_LEVEL_OPTIONS.map((level, index) => ({ value: index, label: level }))}
          onChange={(_event, value: number) => handleLogLevelChange(LOG_LEVEL_OPTIONS[value])}
        />
      </FormGroup>
    </React.Fragment>
  )
}

const ChildLoggerToolbar: React.FunctionComponent = () => {
  const { availableChildLoggers, reloadChildLoggers } = useContext(LogsContext)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const handleAddToggle = () => {
    setIsAddOpen(!isAddOpen)
  }

  const addChildLogger = (logger: ChildLogger) => () => {
    Logger.addChildLogger(logger)
    reloadChildLoggers()
  }

  const availableChildLoggerItems = availableChildLoggers.map(logger => (
    <DropdownItem key={logger.name} onClick={addChildLogger(logger)}>
      {logger.name}
    </DropdownItem>
  ))

  return (
    <Toolbar id='connect-toolbar'>
      <ToolbarContent>
        <ToolbarItem>
          <Dropdown
            onSelect={handleAddToggle}
            onOpenChange={setIsAddOpen}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                id='logs-child-logger-toolbar-dropdown-toggle'
                variant='secondary'
                onClick={handleAddToggle}
              >
                <PlusIcon /> Add
              </MenuToggle>
            )}
            isOpen={isAddOpen}
          >
            <DropdownList>{availableChildLoggerItems}</DropdownList>
          </Dropdown>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  )
}

type ChildLoggerItemProps = {
  logger: ChildLogger
}

const ChildLoggerItem: React.FunctionComponent<ChildLoggerItemProps> = props => {
  const { logger } = props
  const { reloadChildLoggers } = useContext(LogsContext)

  const name = logger.name

  const onLogLevelChange = (level?: string) => {
    if (!level) {
      return
    }
    Logger.updateChildLogger(logger.name, level)
  }

  const onStopDragging = () => {
    reloadChildLoggers()
  }

  const deleteChildLogger = () => {
    Logger.removeChildLogger(logger)
    reloadChildLoggers()
  }

  return (
    <DataListItem key={`logs-child-logger-${name}`} aria-labelledby={`logs child logger ${name}`}>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key={`logs-child-logger-name-${name}`} width={1}>
              <b>{name}</b>
            </DataListCell>,
            <DataListCell key={`logs-child-logger-log-level-${name}`} width={2}>
              <Slider
                id={`logs-child-logger-actions-log-level-slider-${name}`}
                value={LOG_LEVEL_OPTIONS.findIndex(level => level === logger.filterLevel.name)}
                max={LOG_LEVEL_OPTIONS.length - 1}
                customSteps={LOG_LEVEL_OPTIONS.map((level, index) => ({ value: index, label: level }))}
                onChange={(_event, value: number) => onLogLevelChange(LOG_LEVEL_OPTIONS[value])}
                onMouseUp={_event => onStopDragging()}
                onTouchEnd={_event => onStopDragging()}
              />
            </DataListCell>,
          ]}
        />
        <DataListAction
          id={`logs-child-logger-actions-${name}`}
          aria-label={`logs child logger actions ${name}`}
          aria-labelledby={`${name} logs-child-logger-actions-${name}`}
        >
          <Button icon={<TrashIcon />} variant='secondary' onClick={deleteChildLogger}></Button>
        </DataListAction>
      </DataListItemRow>
    </DataListItem>
  )
}
