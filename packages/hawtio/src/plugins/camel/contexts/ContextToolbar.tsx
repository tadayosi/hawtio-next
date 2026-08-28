import { eventService } from '@hawtiosrc/core'
import { workspace } from '@hawtiosrc/plugins/shared'
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  Skeleton,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core'
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated'
import { AsleepIcon } from '@patternfly/react-icons/dist/esm/icons/asleep-icon'
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon'
import { PlayIcon } from '@patternfly/react-icons/dist/esm/icons/play-icon'
import { Remove2Icon } from '@patternfly/react-icons/dist/esm/icons/remove2-icon'
import React, { useState } from 'react'
import {
  CONTEXT_OPERATIONS,
  CONTEXT_STATE_STARTED,
  CONTEXT_STATE_SUSPENDED,
  ContextState,
  contextsService,
} from './contexts-service'

const ConfirmDeleteModal: React.FunctionComponent<{
  isConfirmDeleteOpen: boolean
  handleConfirmDeleteToggle: () => void
  onDeleteConfirmClicked: () => void
}> = ({ isConfirmDeleteOpen, handleConfirmDeleteToggle, onDeleteConfirmClicked }) => (
  <Modal
    variant={ModalVariant.small}
    title='Delete Camel Contexts'
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

export const ContextToolbar: React.FunctionComponent<{
  contexts: ContextState[]
  deleteCallback: (contexts: ContextState[]) => void
}> = ({ contexts, deleteCallback }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // The first context is sampled only to check canInvoke on the context MBean
  const firstContext = contexts[0]

  const onDropdownToggle = (isOpen: boolean) => {
    setIsDropdownOpen(isOpen)
  }

  const isStartEnabled = (): boolean => {
    if (contexts.length === 0) return false

    return contexts.some(ctx => ctx.state === CONTEXT_STATE_SUSPENDED)
  }

  const startContexts = () => {
    contexts
      .filter(ctx => ctx.state === CONTEXT_STATE_SUSPENDED)
      .forEach(ctx =>
        contextsService
          .startContext(ctx)
          .then(() =>
            eventService.notify({
              type: 'success',
              message: 'Camel context start requested',
            }),
          )
          .catch(error =>
            eventService.notify({
              type: 'danger',
              message: `Camel context start failed: ${error}`,
            }),
          ),
      )
  }

  const isSuspendEnabled = (): boolean => {
    if (contexts.length === 0) return false

    return contexts.some(ctx => ctx.state === CONTEXT_STATE_STARTED)
  }

  const suspendContexts = () => {
    contexts
      .filter(ctx => ctx.state === CONTEXT_STATE_STARTED)
      .forEach(ctx =>
        contextsService
          .suspendContext(ctx)
          .then(() =>
            eventService.notify({
              type: 'success',
              message: 'Camel context suspension requested',
            }),
          )
          .catch(error =>
            eventService.notify({
              type: 'danger',
              message: `Camel context suspension failed: ${error}`,
            }),
          ),
      )
  }

  const isDeleteEnabled = (): boolean => {
    return contexts.length > 0
  }

  const handleConfirmDeleteToggle = () => {
    setIsConfirmDeleteOpen(!isConfirmDeleteOpen)
  }

  const onDeleteClicked = () => {
    if (isDeleteEnabled()) {
      setIsDropdownOpen(false)
      handleConfirmDeleteToggle()
    }
  }

  const onDeleteConfirmClicked = () => {
    setIsDeleting(true)
  }

  const deleteContexts = async () => {
    // Use for-of loop to make sure the callback and tree refresh are called after
    // all the deletion is complete
    for (const ctx of contexts) {
      try {
        await contextsService.stopContext(ctx)
        eventService.notify({
          type: 'success',
          message: 'Camel context deleted.',
        })
      } catch (error) {
        eventService.notify({
          type: 'danger',
          message: `Camel context deletion failed: ${error}`,
        })
      }
    }

    deleteCallback(contexts)
    setIsDeleting(false)
    workspace.refreshTree()
  }

  if (isDeleting) {
    deleteContexts()

    const title = `Deleting ${contexts.length > 1 ? 'Contexts' : 'Context'} ...`
    return (
      <Modal variant={ModalVariant.small} title={title} titleIconVariant='warning' isOpen={isDeleting}>
        <Skeleton screenreaderText={title} />
      </Modal>
    )
  }

  const toolbarButtons = (
    <React.Fragment>
      <ToolbarItem>
        <Button
          variant='primary'
          size='sm'
          isDisabled={
            !(firstContext && firstContext.node.hasInvokeRights(CONTEXT_OPERATIONS.start)) || !isStartEnabled()
          }
          icon={<PlayIcon />}
          onClick={startContexts}
        >
          Start
        </Button>
      </ToolbarItem>
      <ToolbarItem>
        <Button
          variant='danger'
          size='sm'
          isDisabled={
            !(firstContext && firstContext.node.hasInvokeRights(CONTEXT_OPERATIONS.suspend)) || !isSuspendEnabled()
          }
          icon={<AsleepIcon />}
          onClick={suspendContexts}
        >
          Suspend
        </Button>
      </ToolbarItem>
    </React.Fragment>
  )

  const dropdownItems = [
    <DropdownItem
      key='delete'
      isDisabled={!(firstContext && firstContext.node.hasInvokeRights(CONTEXT_OPERATIONS.stop)) || !isDeleteEnabled()}
      onClick={onDeleteClicked}
      icon={<Remove2Icon />}
    >
      Delete
    </DropdownItem>,
  ]

  return (
    <React.Fragment>
      <Toolbar id='camel-contexts-toolbar'>
        <ToolbarContent>
          {toolbarButtons}
          <ToolbarItem id='camel-contexts-toolbar-item-dropdown'>
            <Dropdown
              onSelect={() => onDropdownToggle(!isDropdownOpen)}
              onOpenChange={onDropdownToggle}
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  ref={toggleRef}
                  variant='plain'
                  id='camel-contexts-toolbar-item-dropdown-toggle'
                  onClick={() => onDropdownToggle(!isDropdownOpen)}
                  icon={<EllipsisVIcon />}
                />
              )}
              isOpen={isDropdownOpen}
            >
              <DropdownList>{dropdownItems}</DropdownList>
            </Dropdown>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      <ConfirmDeleteModal
        isConfirmDeleteOpen={isConfirmDeleteOpen}
        handleConfirmDeleteToggle={handleConfirmDeleteToggle}
        onDeleteConfirmClicked={onDeleteConfirmClicked}
      />
    </React.Fragment>
  )
}
