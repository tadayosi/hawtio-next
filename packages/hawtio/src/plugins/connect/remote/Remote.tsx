import {
  Connection,
  connectService,
  ConnectStatus,
  INITIAL_CONNECTION,
} from '@hawtiosrc/plugins/shared/connect-service'
import {
  Button,
  DataList,
  DataListAction,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Dropdown,
  DropdownItem,
  DropdownList,
  Icon,
  MenuToggle,
  MenuToggleElement,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core'
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated'
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon'
import { PluggedIcon } from '@patternfly/react-icons/dist/esm/icons/plugged-icon'
import { PlusIcon } from '@patternfly/react-icons/dist/esm/icons/plus-icon'
import { UnpluggedIcon } from '@patternfly/react-icons/dist/esm/icons/unplugged-icon'
import React, { useContext, useEffect, useState } from 'react'
import { DELETE } from '../connections'
import { ConnectContext } from '../context'
import { log } from '../globals'
import { ConnectionModal } from './ConnectionModal'
import { ImportModal } from './ImportModal'
import './Remote.css'

export const Remote: React.FunctionComponent = () => {
  const { connections } = useContext(ConnectContext)
  log.debug('Connections:', connections)

  return (
    <React.Fragment>
      <RemoteToolbar />
      <DataList id='connect-connection-list' aria-label='connection list' isCompact>
        {Object.entries(connections).map(([id, connection]) => (
          <ConnectionItem key={id} id={id} connection={connection} />
        ))}
      </DataList>
    </React.Fragment>
  )
}

const RemoteToolbar: React.FunctionComponent = () => {
  const { connections } = useContext(ConnectContext)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const handleAddToggle = () => {
    setIsAddOpen(!isAddOpen)
  }

  const handleImportModalToggle = () => {
    setIsImportModalOpen(!isImportModalOpen)
  }

  const exportConnections = () => {
    connectService.export(connections)
  }

  const initialConnection = { ...INITIAL_CONNECTION }

  return (
    <Toolbar id='connect-toolbar'>
      <ToolbarContent>
        <ToolbarItem>
          <Button icon={<PlusIcon />} variant='secondary' onClick={handleAddToggle}>
            Add connection
          </Button>
        </ToolbarItem>
        <ToolbarItem>
          <Dropdown
            key='connect-toolbar-dropdown'
            isOpen={isDropdownOpen}
            onOpenChange={setIsDropdownOpen}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                variant='plain'
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                icon={<EllipsisVIcon aria-hidden='true' />}
              />
            )}
          >
            <DropdownList>
              <DropdownItem key='connect-toolbar-dropdown-import' onClick={handleImportModalToggle}>
                Import connections
              </DropdownItem>
              <DropdownItem key='connect-toolbar-dropdown-export' onClick={exportConnections}>
                Export connections
              </DropdownItem>
            </DropdownList>
          </Dropdown>
        </ToolbarItem>
      </ToolbarContent>
      <ConnectionModal mode='add' isOpen={isAddOpen} onClose={handleAddToggle} input={initialConnection} />
      <ImportModal isOpen={isImportModalOpen} onClose={handleImportModalToggle} />
    </Toolbar>
  )
}

const ConfirmDeleteModal: React.FunctionComponent<{
  isConfirmDeleteOpen: boolean,
  handleConfirmDeleteToggle: () => void,
  deleteConnection: () => void,
  connectionName: string,
}> = ({ isConfirmDeleteOpen, handleConfirmDeleteToggle, deleteConnection, connectionName }) => (
    <Modal
        variant={ModalVariant.small}
        title='Delete Connection'
        titleIconVariant='danger'
        isOpen={isConfirmDeleteOpen}
        onClose={handleConfirmDeleteToggle}
        actions={[
          <Button key='delete' variant='danger' onClick={deleteConnection}>
            Delete
          </Button>,
          <Button key='cancel' variant='link' onClick={handleConfirmDeleteToggle}>
            Cancel
          </Button>,
        ]}
    >
      You are about to delete the <b>{connectionName}</b> connection.
    </Modal>
)

const ConnectionItem: React.FunctionComponent<{
  id: string
  connection: Connection
}> = ({ id, connection }) => {
  const { dispatch } = useContext(ConnectContext)
  const [reachable, setReachable] = useState<ConnectStatus>('not-reachable')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  useEffect(() => {
    const check = () => {
      connectService.checkReachable(connection).then(result => setReachable(result))
    }
    check() // initial fire
    const timer = setInterval(check, 20000)
    return () => clearInterval(timer)
  }, [connection])

  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleEditToggle = () => {
    setIsEditOpen(!isEditOpen)
  }

  const handleConfirmDeleteToggle = () => {
    setIsConfirmDeleteOpen(!isConfirmDeleteOpen)
  }

  const connect = () => {
    if (reachable !== 'reachable') {
      return
    }

    log.debug('Connecting:', connection)
    connectService.connect(connection)
  }

  const deleteConnection = () => {
    dispatch({ type: DELETE, id })
    handleConfirmDeleteToggle()
  }

  let icon = null
  switch (reachable) {
    case 'reachable':
      icon = (
        <Icon size='md' status='success'>
          <PluggedIcon />
        </Icon>
      )
      break
    case 'not-reachable':
      icon = (
        <Icon size='md' status='danger'>
          <UnpluggedIcon />
        </Icon>
      )
      break
    case 'not-reachable-securely':
      icon = (
        <Icon size='md' status='warning'>
          <PluggedIcon />
        </Icon>
      )
      break
  }

  return (
    <DataListItem key={`connection-${id}`} aria-labelledby={`connection ${connection.name}`}>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key={`connection-cell-icon-${id}`} isIcon>
              {icon}
            </DataListCell>,
            <DataListCell key={`connection-cell-name-${id}`}>
              <b>{connection.name}</b>
            </DataListCell>,
            <DataListCell key={`connection-cell-url-${id}`} width={3}>
              {connectService.connectionToUrl(connection)}
            </DataListCell>,
          ]}
        />
        <DataListAction
          id={`connection-actions-${id}`}
          aria-label={`connection actions ${connection.name}`}
          aria-labelledby={`${connection.name} connection-actions-${id}`}
        >
          <Button
            key={`connection-action-connect-${id}`}
            variant='primary'
            onClick={connect}
            isDisabled={reachable !== 'reachable'}
            size='sm'
          >
            Connect
          </Button>
          <Dropdown
            key={`connection-action-dropdown-${id}`}
            isOpen={isDropdownOpen}
            onOpenChange={setIsDropdownOpen}
            popperProps={{ position: 'right' }}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                variant='plain'
                ref={toggleRef}
                className='data-list-action-toggle'
                onClick={handleDropdownToggle}
                icon={<EllipsisVIcon />}
              />
            )}
          >
            <DropdownList>
              <DropdownItem key={`connection-action-edit-${id}`} onClick={handleEditToggle}>
                Edit
              </DropdownItem>
              <DropdownItem key={`connection-action-delete-${id}`} onClick={handleConfirmDeleteToggle}>
                Delete
              </DropdownItem>
            </DropdownList>
          </Dropdown>
          <ConfirmDeleteModal isConfirmDeleteOpen={isConfirmDeleteOpen}
                              handleConfirmDeleteToggle={handleConfirmDeleteToggle}
                              deleteConnection={deleteConnection}
                              connectionName={connection.name} />
        </DataListAction>
      </DataListItemRow>
      <ConnectionModal mode='edit' isOpen={isEditOpen} onClose={handleEditToggle} input={connection} />
    </DataListItem>
  )
}
