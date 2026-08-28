import { pluginPath } from '@hawtiosrc/plugins/jmx/globals'
import { AttributeTable, Attributes, Chart, JmxContentMBeans, MBeanNode, Operations } from '@hawtiosrc/plugins/shared'
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
import React from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import './JmxContent.css'
import { pluginPathWithNodeId, useMBeanTreeContext } from './context'

export const JmxContent: React.FunctionComponent = () => {
  const { selectedNode } = useMBeanTreeContext()
  const { pathname, search } = useLocation()

  if (!selectedNode) {
    return (
      <PageSection hasBodyWrapper={false} isFilled>
        <EmptyState headingLevel='h1' icon={CubesIcon} titleText='Select MBean' variant={EmptyStateVariant.full} />
      </PageSection>
    )
  }

  const mBeanApplicable = (node: MBeanNode) => Boolean(node.objectName)
  const mBeanCollectionApplicable = (node: MBeanNode) => Boolean(node.children?.every(child => child.objectName))
  const hasAnyApplicableMBean = (node: MBeanNode) =>
    Boolean(node.objectName) || Boolean(node.children?.some(child => child.objectName))

  const tableSelector = (node: MBeanNode) => {
    const tablePriorityList = [
      { condition: mBeanApplicable, element: Attributes },
      { condition: mBeanCollectionApplicable, element: AttributeTable },
    ]

    return tablePriorityList.find(entry => entry.condition(node))?.element ?? JmxContentMBeans
  }

  const allNavItems = [
    { id: 'attributes', title: 'Attributes', component: tableSelector(selectedNode), isApplicable: () => true },
    { id: 'operations', title: 'Operations', component: Operations, isApplicable: mBeanApplicable },
    { id: 'chart', title: 'Chart', component: Chart, isApplicable: hasAnyApplicableMBean },
  ]

  /* Filter the nav items to those applicable to the selected node */
  const navItems = allNavItems.filter(nav => nav.isApplicable(selectedNode))

  const searchWithNid = pluginPathWithNodeId(selectedNode, pluginPath, new URLSearchParams(search)).search as string

  const mbeanNav = (
    <Nav aria-label='MBean Nav' variant='horizontal-subnav'>
      <NavList>
        {navItems.map(nav => (
          <NavItem key={nav.id} isActive={pathname === `${pluginPath}/${nav.id}`}>
            <NavLink to={{ pathname: `${pluginPath}/${nav.id}`, search: searchWithNid }}>{nav.title}</NavLink>
          </NavItem>
        ))}
      </NavList>
    </Nav>
  )

  const mbeanRoutes = navItems.map(nav => <Route key={nav.id} path={nav.id} Component={nav.component} />)

  return (
    <PageGroup id='jmx-content'>
      <PageSection id='jmx-content-header' hasBodyWrapper={false}>
        <Title headingLevel='h1'>{selectedNode.name}</Title>
        {selectedNode.objectName && <Content component='small'>{selectedNode.objectName}</Content>}
      </PageSection>
      <PageSection type='tabs' hasBodyWrapper={false}>
        {mbeanNav}
      </PageSection>
      <PageSection
        id='jmx-content-main'
        padding={{ default: 'noPadding' }}
        aria-label='jmx-content-main'
        hasBodyWrapper={false}
      >
        <Routes>
          {mbeanRoutes}
          <Route
            key='root'
            path=''
            element={<Navigate to={{ pathname: navItems[0]?.id ?? '', search: searchWithNid }} replace={true} />}
          />
        </Routes>
      </PageSection>
    </PageGroup>
  )
}
