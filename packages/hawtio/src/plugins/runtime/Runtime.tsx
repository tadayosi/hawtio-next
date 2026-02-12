import { Nav, NavItem, NavList, PageGroup, PageSection, Title } from '@patternfly/react-core'
import React from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Metrics } from './Metrics'
import './Runtime.css'
import { SysProps } from './SysProps'
import { Threads } from './Threads'

type NavItem = {
  id: string
  title: string
  component: JSX.Element
}

export const Runtime: React.FunctionComponent = () => {
  const { pathname, search } = useLocation()
  const navItems: NavItem[] = [
    { id: 'sysprops', title: 'System properties', component: <SysProps /> },
    { id: 'metrics', title: 'Metrics', component: <Metrics /> },
    { id: 'threads', title: 'Threads', component: <Threads /> },
  ]

  return (
    <React.Fragment>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel='h1'>Runtime</Title>
      </PageSection>
      <PageGroup>
        <PageSection type='tabs' hasBodyWrapper={false}>
          <Nav aria-label='Runtime Nav' variant='horizontal-subnav'>
            <NavList>
              {navItems.map(({ id, title }) => (
                <NavItem key={id} isActive={pathname === `/runtime/${id}`}>
                  <NavLink to={{ pathname: id, search }}>{title}</NavLink>
                </NavItem>
              ))}
            </NavList>
          </Nav>
        </PageSection>
      </PageGroup>
      <PageSection padding={{ default: 'noPadding' }} hasBodyWrapper={false}>
        <Routes>
          {navItems.map(({ id, component }) => (
            <Route key={id} path={id} element={component} />
          ))}
          <Route path='/' element={<Navigate to={{ pathname: 'sysprops', search }} />} />
        </Routes>
      </PageSection>
    </React.Fragment>
  )
}
