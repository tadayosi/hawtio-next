import React, { useContext, useEffect, useState } from 'react'
import { CamelContext } from '__root__/camel/context'
import { CamelRoute, routesService } from '__root__/camel/routes-service'
import { Caption, TableComposable, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  KebabToggle,
  Modal,
  ModalVariant,
  Page,
  Text,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core'
import { AsleepIcon, InfoCircleIcon, PlayIcon, Remove2Icon } from '@patternfly/react-icons'
import { eventService } from '@hawtio/react/core'
import { workspace } from '__root__/shared'

export const CamelRoutes: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [routes, setRoutes] = useState<CamelRoute[]>([])
  const [reload, setReload] = useState<boolean>(false)
  const [selected, setSelected] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  useEffect(() => {
    const getRouteAttributes = async () => {
      const routes = await routesService.getRoutesAttributes(selectedNode)
      setRoutes(routes)
    }

    getRouteAttributes()
  }, [selectedNode, reload])

  const onDropdownToggle = (isOpen: boolean) => {
    setIsOpen(isOpen)
  }

  const onSelect = (routeId: string, isSelecting: boolean) => {
    const selectedRoutes = selected.filter(r => routeId !== r)
    setSelected(isSelecting ? [...selectedRoutes, routeId] : [...selectedRoutes])
  }

  const onSelectAll = (isSelected: boolean) => {
    const selected = routes.map(r => r.RouteId)
    setSelected(isSelected ? selected : [])
  }

  const isAllSelected = (): boolean => {
    return selected.length === routes.length
  }

  const isSuspendEnabled = (state: string): boolean => {
    let res = false
    selected.forEach(id => {
      const route = routes.find(r => r.RouteId === id)
      if (route && route.State === state) res = true
    })
    return res
  }

  async function onStopClicked() {
    let stoppedCount = 0
    for (const routeId of selected) {
      const route = routes.find(r => r.RouteId === routeId && r.State === 'Started')
      try {
        await routesService.stopRoute(route?.objectName as string)
        stoppedCount++
      } catch (error) {
        eventService.notify({
          type: 'danger',
          message: `Couldn't stop the route: ${error}`,
        })
      }
    }

    if (stoppedCount > 0) {
      eventService.notify({
        type: 'success',
        message: `${stoppedCount} routes stopped successfully`,
      })
    }
    setReload(!reload)
  }

  async function onStartClicked() {
    let startedCount = 0

    for (const routeId of selected) {
      const route = routes.find(r => r.RouteId === routeId && r.State === 'Stopped')
      try {
        await routesService.startRoute(route?.objectName as string)
        startedCount++
      } catch (error) {
        eventService.notify({
          type: 'danger',
          message: `Couldn't start the route: ${error}`,
        })
      }
    }

    if (startedCount > 0) {
      eventService.notify({
        type: 'success',
        message: `${startedCount} routes started successfully`,
      })
    }
    setReload(!reload)
  }

  function onDeleteClicked() {
    setIsConfirmDeleteOpen(true)
    setIsOpen(false)
  }

  const handleConfirmDeleteToggle = () => {
    setIsConfirmDeleteOpen(!isConfirmDeleteOpen)
  }

  const dropdownItems = [
    <DropdownItem key='action' componentID='deleteAction'>
      <Button
        variant='control'
        isDisabled={!isSuspendEnabled('Stopped')}
        isSmall={true}
        icon={React.createElement(Remove2Icon)}
        onClick={onDeleteClicked}
      >
        Delete
      </Button>
    </DropdownItem>,
  ]
  const toolbarButtons = (
    <React.Fragment>
      <ToolbarItem>
        <Button
          variant='secondary'
          isSmall={true}
          isDisabled={!isSuspendEnabled('Stopped')}
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
          isDisabled={!isSuspendEnabled('Started')}
          icon={React.createElement(AsleepIcon)}
          onClick={onStopClicked}
        >
          Stop
        </Button>
      </ToolbarItem>
    </React.Fragment>
  )

  async function onDeleteConfirmClicked() {
    let deleted = 0
    for (const routeId of selected) {
      const route = routes.find(r => r.RouteId === routeId && r.State === 'Stopped')
      try {
        await routesService.deleteRoute(route?.objectName as string)
        deleted++
        workspace.refreshTree()
      } catch (error) {
        eventService.notify({
          type: 'danger',
          message: `Couldn't delete the route: ${error}`,
        })
      }
    }
    if (deleted > 0) {
      eventService.notify({
        type: 'success',
        message: `${deleted} routes deleted successfully`,
      })
    }
    setSelected([])
    setRoutes([])
    setIsConfirmDeleteOpen(false)
  }

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
      <p>You are about to delete selected camel routes.</p>
      <p>This operation cannot be undone so please be careful.</p>
    </Modal>
  )
  return (
    <Page>
      {routes.length === 0 && (
        <Card>
          <CardBody>
            <Text component='p'>
              <InfoCircleIcon /> This context does not have any routes.
            </Text>
          </CardBody>
        </Card>
      )}
      {routes.length > 0 && (
        <TableComposable aria-label='Simple table' variant={'compact'}>
          <Caption>
            Routes
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
          </Caption>

          <Thead>
            <Tr>
              <Th
                select={{
                  onSelect: (_event, isSelecting) => onSelectAll(isSelecting),
                  isSelected: isAllSelected(),
                }}
              />
              <Th>{'Name'}</Th>
              <Th>{'State'}</Th>
              <Th>{'Uptime'}</Th>
              <Th>{'Completed'}</Th>
              <Th>{'Failed'}</Th>
              <Th>{'Handled'}</Th>
              <Th>{'Total'}</Th>
              <Th>{'InFlight'}</Th>
              <Th>{'Meantime'}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {routes.map((route, rowIndex) => {
              return (
                <Tr key={route.RouteId}>
                  <Td
                    select={{
                      rowIndex,
                      onSelect: (_event, isSelected) => {
                        onSelect(route.RouteId, isSelected)
                      },
                      isSelected: selected.includes(route.RouteId),
                    }}
                  />
                  <Td dataLabel={'Name'}>{route.RouteId}</Td>
                  <Td dataLabel={'State'}>{route.State}</Td>
                  <Td dataLabel={'Uptime'}>{route.Uptime}</Td>
                  <Td dataLabel={'Completed'}>{route.ExchangesCompleted}</Td>
                  <Td dataLabel={'Failed'}>{route.ExchangesFailed}</Td>
                  <Td dataLabel={'Handled'}>{route.FailuresHandled}</Td>
                  <Td dataLabel={'Total'}>{route.ExchangesTotal}</Td>
                  <Td dataLabel={'InFlight'}>{route.ExchangesInflight}</Td>
                  <Td dataLabel={'Meantime'}>{route.MeanProcessingTime}</Td>
                </Tr>
              )
            })}
          </Tbody>
        </TableComposable>
      )}
      <ConfirmDeleteModal />
    </Page>
  )
}
