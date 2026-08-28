import { eventService } from '@hawtiosrc/core'
import { HawtioEmptyCard, HawtioLoadingCard, workspace } from '@hawtiosrc/plugins/shared'
import { objectSorter } from '@hawtiosrc/util/objects'
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  Label,
  MenuToggle,
  MenuToggleElement,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core'
import { Modal } from '@patternfly/react-core/deprecated'
import { AsleepIcon } from '@patternfly/react-icons/dist/esm/icons/asleep-icon'
import { PlayIcon } from '@patternfly/react-icons/dist/esm/icons/play-icon'
import { Remove2Icon } from '@patternfly/react-icons/dist/esm/icons/remove2-icon'
import { Table, Tbody, Td, Th, ThProps, Thead, Tr } from '@patternfly/react-table'
import React, { useContext, useEffect, useState } from 'react'
import { CamelContext } from '../context'
import { CamelRoute } from './route'
import { routesService } from './routes-service'
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon'

const ROUTES_REFRESH_INTERVAL = 10000 // milliseconds

export const RouteStateLabel: React.FunctionComponent<{ state: string | null }> = ({ state }) => {
  if (!state) {
    return <Label color='grey'>Unknown</Label>
  }
  return state === 'Started' ? <Label color='green'>{state}</Label> : <Label color='red'>{state}</Label>
}

const ConfirmDeleteModal: React.FunctionComponent<{
  isConfirmDeleteOpen: boolean
  deleteRoutes: () => void
  handleConfirmDeleteToggle: () => void
}> = ({ isConfirmDeleteOpen, deleteRoutes, handleConfirmDeleteToggle }) => (
  <Modal
    variant='small'
    title='Delete Camel Routes'
    titleIconVariant='danger'
    isOpen={isConfirmDeleteOpen}
    onClose={handleConfirmDeleteToggle}
    actions={[
      <Button key='delete' variant='danger' onClick={deleteRoutes}>
        Delete
      </Button>,
      <Button key='cancel' variant='link' onClick={handleConfirmDeleteToggle}>
        Cancel
      </Button>,
    ]}
  >
    <p>You are about to delete the selected camel routes.</p>
    <p>This operation cannot be undone so please be careful.</p>
  </Modal>
)

export const CamelRoutes: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [routes, setRoutes] = useState<CamelRoute[]>([])
  const [isReading, setIsReading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [activeSortIndex, setActiveSortIndex] = useState(-1)
  const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (!selectedNode) {
      return
    }

    let timeoutHandle: NodeJS.Timeout
    const getRouteAttributes = async () => {
      setIsReading(true)
      const routes = await routesService.getRoutesAttributes(selectedNode)
      setRoutes(routes)
      setIsReading(false)

      timeoutHandle = setTimeout(getRouteAttributes, ROUTES_REFRESH_INTERVAL)
    }

    getRouteAttributes()

    return () => timeoutHandle && clearTimeout(timeoutHandle)
  }, [selectedNode])

  if (!selectedNode) {
    return null
  }

  if (isReading) {
    return <HawtioLoadingCard />
  }

  if (routes.length === 0) {
    return <HawtioEmptyCard message='This context does not have any routes.' />
  }

  // Sort routes in place
  if (activeSortIndex >= 0) {
    routes.sort((a, b) => {
      const aValue = a.toArrayForSort()[activeSortIndex]
      const bValue = b.toArrayForSort()[activeSortIndex]
      return objectSorter(aValue, bValue, activeSortDirection === 'desc')
    })
  }

  const onSelect = (routeId: string, isSelecting: boolean) => {
    const selectedRoutes = selected.filter(r => routeId !== r)
    setSelected(isSelecting ? [...selectedRoutes, routeId] : [...selectedRoutes])
  }

  const onSelectAll = (isSelected: boolean) => {
    const selected = routes.map(r => r.routeId)
    setSelected(isSelected ? selected : [])
  }

  const isAllSelected = (): boolean => {
    return selected.length === routes.length
  }

  const handleConfirmDeleteToggle = () => {
    setIsConfirmDeleteOpen(!isConfirmDeleteOpen)
  }

  const getSortParams = (columnIndex: number): ThProps['sort'] => ({
    sortBy: {
      index: activeSortIndex,
      direction: activeSortDirection,
      defaultDirection: 'asc', // starting sort direction when first sorting a column. Defaults to 'asc'
    },
    onSort: (_event, index, direction) => {
      setActiveSortIndex(index)
      setActiveSortDirection(direction)
    },
    columnIndex,
  })

  const deleteRoutes = async () => {
    let deleted = 0
    for (const routeId of selected) {
      const route = routes.find(r => r.routeId === routeId && r.state === 'Stopped')
      if (!route) {
        continue
      }
      try {
        await routesService.deleteRoute(route.node)
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

  return (
    <React.Fragment>
      <CamelRoutesToolbar
        routes={routes}
        selectedRoutes={selected}
        handleConfirmDeleteToggle={handleConfirmDeleteToggle}
      />
      <Table id='camel-routes-table' data-testid='camel-routes-table' aria-label='Camel routes table' variant='compact'>
        <Thead noWrap>
          <Tr>
            <Th
              aria-label='select-route-header'
              select={{
                onSelect: (_event, isSelecting) => onSelectAll(isSelecting),
                isSelected: isAllSelected(),
              }}
            />
            <Th data-testid='name-header' sort={getSortParams(0)}>
              Name
            </Th>
            <Th data-testid='state-header' sort={getSortParams(1)}>
              State
            </Th>
            <Th data-testid='uptime-header' sort={getSortParams(2)}>
              Uptime
            </Th>
            <Th data-testid='completed-header' sort={getSortParams(3)}>
              Completed
            </Th>
            <Th data-testid='failed-header' sort={getSortParams(4)}>
              Failed
            </Th>
            <Th data-testid='handled-header' sort={getSortParams(5)}>
              Handled
            </Th>
            <Th data-testid='total-header' sort={getSortParams(6)}>
              Total
            </Th>
            <Th data-testid='inflight-header' sort={getSortParams(7)}>
              InFlight
            </Th>
            <Th data-testid='meantime-header' sort={getSortParams(8)}>
              Meantime
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {routes.map((route, rowIndex) => {
            return (
              <Tr data-testid={'row' + rowIndex} key={route.routeId}>
                <Td
                  select={{
                    rowIndex,
                    onSelect: (_event, isSelected) => {
                      onSelect(route.routeId, isSelected)
                    },
                    isSelected: selected.includes(route.routeId),
                  }}
                />
                <Td dataLabel='Name'>{route.routeId}</Td>
                <Td dataLabel='State'>
                  <RouteStateLabel state={route.state} />
                </Td>
                <Td dataLabel='Uptime'>{route.uptime}</Td>
                <Td dataLabel='Completed'>{route.exchangesCompleted}</Td>
                <Td dataLabel='Failed'>{route.exchangesFailed}</Td>
                <Td dataLabel='Handled'>{route.failuresHandled}</Td>
                <Td dataLabel='Total'>{route.exchangesTotal}</Td>
                <Td dataLabel='InFlight'>{route.exchangesInflight}</Td>
                <Td dataLabel='Meantime'>{route.meanProcessingTime}</Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
      <ConfirmDeleteModal
        isConfirmDeleteOpen={isConfirmDeleteOpen}
        deleteRoutes={deleteRoutes}
        handleConfirmDeleteToggle={handleConfirmDeleteToggle}
      />
    </React.Fragment>
  )
}

const CamelRoutesToolbar: React.FunctionComponent<{
  routes: CamelRoute[]
  selectedRoutes: string[]
  handleConfirmDeleteToggle: () => void
}> = ({ routes, selectedRoutes, handleConfirmDeleteToggle }) => {
  const { selectedNode } = useContext(CamelContext)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  if (!selectedNode) {
    return null
  }

  // The first route is sampled only to check RBAC on the route MBean
  const firstRoute = routes[0]
  if (!firstRoute) {
    return null
  }

  const isSuspendEnabled = (state: string): boolean => {
    let res = false
    selectedRoutes.forEach(id => {
      const route = routes.find(r => r.routeId === id)
      if (route && route.state === state) res = true
    })
    return res
  }

  const startRoutes = async () => {
    let startedCount = 0
    for (const routeId of selectedRoutes) {
      const route = routes.find(r => r.routeId === routeId && r.state === 'Stopped')
      if (!route) {
        continue
      }
      try {
        await routesService.startRoute(route.node)
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
  }

  const stopRoutes = async () => {
    let stoppedCount = 0
    for (const routeId of selectedRoutes) {
      const route = routes.find(r => r.routeId === routeId && r.state === 'Started')
      if (!route) {
        continue
      }
      try {
        await routesService.stopRoute(route.node)
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
  }

  const onDeleteClicked = () => {
    handleConfirmDeleteToggle()
    setIsDropdownOpen(false)
  }

  const onDropdownToggle = (isOpen: boolean) => {
    setIsDropdownOpen(isOpen)
  }

  const toolbarButtons = (
    <React.Fragment>
      <ToolbarItem>
        <Button
          variant='primary'
          size='sm'
          isDisabled={!routesService.canStartRoute(firstRoute.node) || !isSuspendEnabled('Stopped')}
          icon={<PlayIcon />}
          onClick={startRoutes}
        >
          Start
        </Button>
      </ToolbarItem>
      <ToolbarItem>
        <Button
          variant='danger'
          size='sm'
          isDisabled={!routesService.canStopRoute(firstRoute.node) || !isSuspendEnabled('Started')}
          icon={<AsleepIcon />}
          onClick={stopRoutes}
        >
          Stop
        </Button>
      </ToolbarItem>
    </React.Fragment>
  )

  const dropdownItems = [
    <DropdownItem
      key='action'
      isDisabled={!routesService.canDeleteRoute(firstRoute.node) || !isSuspendEnabled('Stopped')}
      onClick={onDeleteClicked}
    >
      <Remove2Icon /> Delete
    </DropdownItem>,
  ]

  return (
    <Toolbar id='camel-routes-toolbar'>
      <ToolbarContent>
        {toolbarButtons}
        <ToolbarItem id='camel-routes-toolbar-item-dropdown'>
          <Dropdown
            onSelect={() => onDropdownToggle(!isDropdownOpen)}
            onOpenChange={setIsDropdownOpen}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                variant='plain'
                id='camel-routes-toolbar-item-dropdown-toggle'
                onClick={() => onDropdownToggle(!isDropdownOpen)}
              >
                <EllipsisVIcon />
              </MenuToggle>
            )}
            isOpen={isDropdownOpen}
          >
            <DropdownList>{dropdownItems}</DropdownList>
          </Dropdown>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  )
}
