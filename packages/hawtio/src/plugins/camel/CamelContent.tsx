import { eventService } from '@hawtiosrc/core'
import { AttributeValues, Attributes, Chart, JmxContentMBeans, MBeanNode, Operations } from '@hawtiosrc/plugins/shared'
import {
  Content,
  EmptyState,
  EmptyStateVariant,
  Nav,
  NavItem,
  NavList,
  PageGroup,
  PageSection,
  Title,
} from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon'
import Jolokia, { JolokiaErrorResponse, JolokiaSuccessResponse } from 'jolokia.js'
import React, { useContext, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './CamelContent.css'
import * as camelService from './camel-service'
import { CamelContext } from './context'
import { Contexts } from './contexts'
import { ContextToolbar } from './contexts/ContextToolbar'
import { ContextState, contextsService } from './contexts/contexts-service'
import { Debug } from './debug'
import { Endpoints } from './endpoints'
import { BrowseMessages } from './endpoints/BrowseMessages'
import { EndpointStats } from './endpoints/EndpointsStats'
import { SendMessage } from './endpoints/SendMessage'
import { Exchanges } from './exchanges'
import { log, pluginPath } from './globals'
import { Profile } from './profile/Profile'
import { Properties } from './properties'
import { RestServices } from './rest-services/RestServices'
import { RouteDiagramContext, useRouteDiagramContext } from './route-diagram-context'
import { RouteDiagram } from './route-diagram/RouteDiagram'
import { CamelRoutes } from './routes/CamelRoutes'
import { Source } from './routes/Source'
import { Trace } from './trace'
import { TypeConverters } from './type-converters'

type NavItem = {
  id: string
  title: string
  component: JSX.Element
  isApplicable: (node: MBeanNode) => boolean
}

export const CamelContent: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const routeDiagramContext = useRouteDiagramContext()
  const { pathname, search } = useLocation()

  if (!selectedNode) {
    return (
      <PageSection hasBodyWrapper={false} isFilled>
        <EmptyState
          headingLevel='h1'
          icon={CubesIcon}
          titleText='Select Camel Node'
          variant={EmptyStateVariant.full}
        ></EmptyState>
      </PageSection>
    )
  }

  /*
   * Test if nav should contain general mbean tabs
   */
  const isDefaultApplicable = (node: MBeanNode) => {
    return (
      camelService.hasMBean(node) &&
      !camelService.isContextsFolder(node) &&
      !camelService.isRoutesFolder(node) &&
      !camelService.isRouteXmlNode(node)
    )
  }

  // The order of the items in the following list is the order in will the tabs will be visualized.
  // For more info check: https://github.com/hawtio/hawtio-next/issues/237
  const allNavItems: NavItem[] = [
    {
      id: 'routeDiagram',
      title: 'Route Diagram',
      component: (
        <RouteDiagramContext.Provider value={routeDiagramContext}>
          <RouteDiagram />
        </RouteDiagramContext.Provider>
      ),
      isApplicable: camelService.canViewRouteDiagram,
    },
    { id: 'attributes', title: 'Attributes', component: <Attributes />, isApplicable: isDefaultApplicable },
    { id: 'operations', title: 'Operations', component: <Operations />, isApplicable: isDefaultApplicable },
    { id: 'contexts', title: 'Contexts', component: <Contexts />, isApplicable: camelService.isContextsFolder },
    { id: 'routes', title: 'Routes', component: <CamelRoutes />, isApplicable: camelService.isRoutesFolder },
    { id: 'endpoints', title: 'Endpoints', component: <Endpoints />, isApplicable: camelService.isEndpointsFolder },
    {
      id: 'source',
      title: 'Source',
      component: <Source />,
      isApplicable: camelService.canViewSource,
    },
    { id: 'properties', title: 'Properties', component: <Properties />, isApplicable: camelService.hasProperties },
    {
      id: 'send',
      title: 'Send',
      component: <SendMessage />,
      isApplicable: camelService.canSendMessage,
    },
    {
      id: 'browse',
      title: 'Browse',
      component: <BrowseMessages />,
      isApplicable: camelService.canBrowseMessages,
    },
    {
      id: 'endpoint-stats',
      title: 'Endpoints (in/out)',
      component: <EndpointStats />,
      isApplicable: camelService.canViewEndpointStats,
    },
    { id: 'exchanges', title: 'Exchanges', component: <Exchanges />, isApplicable: camelService.hasExchange },
    {
      id: 'rest-services',
      title: 'Rest Services',
      component: <RestServices />,
      isApplicable: camelService.hasRestServices,
    },
    {
      id: 'type-converters',
      title: 'Type Converters',
      component: <TypeConverters />,
      isApplicable: camelService.hasTypeConverter,
    },
    { id: 'chart', title: 'Chart', component: <Chart />, isApplicable: isDefaultApplicable },
    // Applicable for same criteria as trace
    { id: 'profile', title: 'Profile', component: <Profile />, isApplicable: camelService.canTrace },
    { id: 'trace', title: 'Trace', component: <Trace />, isApplicable: camelService.canTrace },
    { id: 'debug', title: 'Debug', component: <Debug />, isApplicable: camelService.canGetBreakpoints },
  ]

  /* Filter the nav items to those applicable to the selected node */
  const navItems = allNavItems.filter(nav => nav.isApplicable(selectedNode))

  const camelNav = (
    <Nav aria-label='Camel Nav' variant='horizontal-subnav'>
      <NavList>
        {navItems.map(nav => (
          <NavItem key={nav.id} isActive={pathname === `${pluginPath}/${nav.id}`}>
            <NavLink to={{ pathname: nav.id, search }}>{nav.title}</NavLink>
          </NavItem>
        ))}
      </NavList>
    </Nav>
  )

  const camelNavRoutes = navItems.map(nav => <Route key={nav.id} path={nav.id} element={nav.component} />)

  return (
    <PageGroup id='camel-content'>
      <PageSection id='camel-content-header' hasBodyWrapper={false}>
        {camelService.isContext(selectedNode) && <CamelContentContextToolbar />}
        <Title headingLevel='h1'>{selectedNode.name}</Title>
        {selectedNode.objectName && <Content component='small'>{selectedNode.objectName}</Content>}
      </PageSection>
      {navItems.length > 1 && (
        <PageSection type='tabs' hasBodyWrapper={false}>
          {camelNav}
        </PageSection>
      )}
      <PageSection
        id='camel-content-main'
        hasBodyWrapper={false}
        padding={{ default: 'noPadding' }}
        hasOverflowScroll
        aria-label='camel-content-main'
      >
        {navItems.length > 0 && (
          <Routes>
            {camelNavRoutes}
            <Route key='root' path='/' element={<Navigate to={navItems[0]?.id ?? ''} />} />
          </Routes>
        )}
        {navItems.length === 0 && !selectedNode.objectName && <JmxContentMBeans />}
      </PageSection>
    </PageGroup>
  )
}

const CamelContentContextToolbar: React.FunctionComponent = () => {
  const { selectedNode, setSelectedNode } = useContext(CamelContext)
  const [contextState, setContextState] = useState<ContextState | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Attributes only needed if a context has been selected
    if (!selectedNode || !selectedNode.objectName || !camelService.isContext(selectedNode)) {
      return
    }

    const { objectName } = selectedNode
    const readAttributes = async () => {
      const attr = await contextsService.getContext(selectedNode)
      if (attr) setContextState(attr)

      contextsService.register(
        { type: 'read', mbean: objectName },
        (response: JolokiaSuccessResponse | JolokiaErrorResponse) => {
          if (Jolokia.isError(response)) {
            log.debug('Scheduler - Contexts (error):', response.error)
            return
          }
          log.debug('Scheduler - Contexts:', response.value)

          // Replace the context in the existing set with the new one
          const attrs = response.value as AttributeValues
          const newAttrs = contextsService.toContextState(selectedNode, attrs)
          if (newAttrs) setContextState(newAttrs)
        },
      )
    }
    readAttributes()

    return () => contextsService.unregisterAll()
  }, [selectedNode])

  /*
   * Callback the is fired after the delete button has been
   * clicked in the toolbar
   */
  const handleDeletedContext = () => {
    setSelectedNode(null)

    // Navigate away from this context as it no longer exists
    navigate('/jmx')

    eventService.notify({
      type: 'warning',
      message: 'No Camel domain detected. Redirecting to back to JMX.',
    })
  }

  return <ContextToolbar contexts={contextState ? [contextState] : []} deleteCallback={handleDeletedContext} />
}
