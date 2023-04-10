import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  KebabToggle,
  Modal,
  ModalVariant,
  Text,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core'
import { AsleepIcon, InfoCircleIcon, PlayIcon, Remove2Icon } from '@patternfly/react-icons'
import { Table, TableBody, TableHeader, TableProps, wrappable } from '@patternfly/react-table'
import { IResponse } from 'jolokia.js'
import { AttributeValues } from '__root__/connect/jolokia-service'
import React, { useEffect, useState, useContext } from 'react'
import { CamelContext } from '__root__/camel/context'
import { log } from '../globals'
import { contextsService, ContextAttributes } from './contexts-service'
import { eventService } from '@hawtio/react/core'
import { workspace } from '__root__/shared'

export const Contexts: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [isReading, setIsReading] = useState(true)

  const emptyCtxs: ContextAttributes[] = []
  const [contexts, setContexts] = useState(emptyCtxs)
  const [selectedCtxId, setSelectedCtxId] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  const onSelectContext = (ctx: ContextAttributes, isSelecting: boolean) => {
    const otherSelectedCtx = selectedCtxId.filter(c => c !== ctx.context)
    setSelectedCtxId(isSelecting ? [...otherSelectedCtx, ctx.context] : [...otherSelectedCtx])
  }

  const selectAllContexts = (isSelecting = true) => {
    setSelectedCtxId(isSelecting ? contexts.map(c => c.context) : [])
  }

  const isContextSelected = (ctx: ContextAttributes) => {
    return selectedCtxId.includes(ctx.context)
  }

  const onDropdownToggle = (isOpen: boolean) => {
    setIsOpen(isOpen)
  }

  const isStartEnabled = (): boolean => {
    return selectedCtxId.some(id => {
      const ctx = contexts.find(c => c.context === id)
      return ctx && ctx.state === 'Suspended'
    })
  }

  const onStartClicked = () => {
    contexts
      .filter(ctx => {
        const id = selectedCtxId.find(id => ctx.context === id)
        return id && ctx.state === 'Suspended'
      })
      .forEach(ctx => {
        contextsService
          .startContext(ctx)
          .then(() => {
            eventService.notify({
              type: 'success',
              message: 'Camel context started successfully',
            })
          })
          .catch((error: Error) => {
            eventService.notify({
              type: 'danger',
              message: error.message,
            })
          })
      })
  }

  const isSuspendEnabled = (): boolean => {
    return selectedCtxId.some(id => {
      const ctx = contexts.find(c => c.context === id)
      return ctx && ctx.state === 'Started'
    })
  }

  const onSuspendClicked = () => {
    contexts
      .filter(ctx => {
        const id = selectedCtxId.find(id => ctx.context === id)
        return id && ctx.state === 'Started'
      })
      .forEach(ctx => {
        contextsService
          .suspendContext(ctx)
          .then(() => {
            eventService.notify({
              type: 'success',
              message: 'Camel context suspended successfully',
            })
          })
          .catch((error: Error) => {
            eventService.notify({
              type: 'danger',
              message: error.message,
            })
          })
      })
  }

  const isDeleteEnabled = (): boolean => {
    return selectedCtxId.length > 0
  }

  const handleConfirmDeleteToggle = () => {
    setIsConfirmDeleteOpen(!isConfirmDeleteOpen)
  }

  const onDeleteClicked = () => {
    setIsOpen(false)
    handleConfirmDeleteToggle()
  }

  const onDeleteConfirmClicked = () => {
    const toDelete = contexts.filter(ctx => selectedCtxId.find(id => ctx.context === id))

    let deleteProcessed = 0
    toDelete.forEach(async ctx => {
      try {
        await contextsService.stopContext(ctx)
        eventService.notify({
          type: 'success',
          message: 'Camel context deleted.',
        })
      } catch (error) {
        eventService.notify({
          type: 'danger',
          message: error as string,
        })
      }

      deleteProcessed++
      if (deleteProcessed === toDelete.length) {
        setContexts(contexts.filter(c => toDelete.indexOf(c) < 0))
        workspace.refreshTree()
      }
    })
  }

  useEffect(() => {
    setIsReading(true)
    const readAttributes = async () => {
      try {
        const ctxs = await contextsService.getContexts(selectedNode)
        setContexts(ctxs)
      } catch (error) {
        eventService.notify({
          type: 'warning',
          message: error as string,
        })
      }
      setIsReading(false)
    }
    readAttributes()
  }, [selectedNode])

  useEffect(() => {
    if (!contexts || contexts.length === 0) return

    for (const [idx, ctx] of contexts.entries()) {
      const mbean = ctx.mbean
      contextsService.register({ type: 'read', mbean }, (response: IResponse) => {
        log.debug('Scheduler - Contexts:', response.value)

        /* Replace the context in the existing set with the new one */
        const newCtx: ContextAttributes = contextsService.createContextAttibutes(
          ctx.context,
          mbean,
          response.value as AttributeValues,
        )

        /* Replace the context in the contexts array */
        const newContexts = [...contexts]
        newContexts.splice(idx, 1, newCtx)
        setContexts(newContexts)
      })
    }

    return () => contextsService.unregisterAll()
  }, [selectedNode, contexts])

  if (!selectedNode) {
    return null
  }

  if (isReading) {
    return (
      <Card>
        <CardBody>
          <Text component='p'>Reading contexts...</Text>
        </CardBody>
      </Card>
    )
  }

  /**
   * Populate the column headers and data using the positions
   * of the headers in the array to ensure the correct locations
   * of the data
   */
  const columns: TableProps['cells'] = []
  columns.push({ title: 'Context', transforms: [wrappable] })
  columns.push({ title: 'State', transforms: [wrappable] })

  const rows: TableProps['rows'] = []
  for (const ctx of contexts) {
    rows.push({
      cells: [ctx.context, ctx.state],
      selected: isContextSelected(ctx),
    })
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody>
          <Text component='p'>
            <InfoCircleIcon /> This domain has no contexts.
          </Text>
        </CardBody>
      </Card>
    )
  }

  const toolbarButtons = (
    <React.Fragment>
      <ToolbarItem>
        <Button
          variant='secondary'
          isSmall={true}
          isDisabled={!isStartEnabled()}
          icon={React.createElement(PlayIcon)}
          onClick={onStartClicked}
        >
          Start
        </Button>
      </ToolbarItem>
      <ToolbarItem>
        <Button
          variant='secondary'
          isSmall={true}
          isDisabled={!isSuspendEnabled()}
          icon={React.createElement(AsleepIcon)}
          onClick={onSuspendClicked}
        >
          Suspend
        </Button>
      </ToolbarItem>
    </React.Fragment>
  )

  const ConfirmDeleteModal = () => (
    <Modal
      variant={ModalVariant.small}
      title='Are you sure?'
      titleIconVariant='danger'
      isOpen={isConfirmDeleteOpen}
      onClose={handleConfirmDeleteToggle}
      actions={[
        <Button key='delete' variant='danger' onClick={onDeleteConfirmClicked}>
          Delete
        </Button>,
        <Button key='cancel' variant='link' onClick={handleConfirmDeleteToggle}>
          Cancel
        </Button>,
      ]}
    >
      <p>You are about to delete this Camel Context.</p>
      <p>This operation cannot be undone so please be careful.</p>
    </Modal>
  )

  const dropdownItems = [
    <DropdownItem key='action' componentID='deleteAction'>
      <Button
        variant='control'
        isSmall={true}
        isDisabled={!isDeleteEnabled()}
        icon={React.createElement(Remove2Icon)}
        onClick={onDeleteClicked}
      >
        Delete
      </Button>
    </DropdownItem>,
  ]

  return (
    <Card isFullHeight>
      <Toolbar id='toolbar-items'>
        <ToolbarContent>
          {toolbarButtons}
          <ToolbarItem>
            <Dropdown
              autoFocus={true}
              toggle={<KebabToggle id='toggle-kebab' onToggle={onDropdownToggle} />}
              isOpen={isOpen}
              dropdownItems={dropdownItems}
            />
          </ToolbarItem>
          <ToolbarItem variant='separator' />
        </ToolbarContent>
      </Toolbar>
      <Table
        onSelect={(_event, isSelecting, rowIndex) => {
          if (rowIndex === -1) {
            selectAllContexts(isSelecting)
          } else {
            const ctx = contexts[rowIndex]
            onSelectContext(ctx, isSelecting)
          }
        }}
        canSelectAll={true}
        aria-label='Contexts'
        variant={'compact'}
        cells={columns}
        rows={rows}
      >
        <TableHeader />
        <TableBody />
      </Table>
      <ConfirmDeleteModal />
    </Card>
  )
}
