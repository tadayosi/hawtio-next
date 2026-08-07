import { Nav, NavItem, NavList, PageGroup, PageSection, Title } from '@patternfly/react-core'
import React from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router'
import { FlightRecorder } from './FlightRecorder'
import { pluginPath } from './globals'

type NavItem = {
  id: string
  title: string
  component: JSX.Element
}

export const JvmDiagnostics: React.FunctionComponent = () => {
  const { pathname, search } = useLocation()

  const navItems: NavItem[] = [{ id: 'jfr', title: 'Flight Recorder', component: <FlightRecorder /> }]

  return (
    <React.Fragment>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel='h1'>JVM Diagnostics</Title>
      </PageSection>
      <PageGroup>
        <PageSection type='tabs' hasBodyWrapper={false}>
          <Nav aria-label='JVM Diagnostics Nav' variant='horizontal-subnav'>
            <NavList>
              {navItems.map(({ id, title }) => (
                <NavItem key={id} isActive={pathname === `${pluginPath}/${id}`}>
                  <NavLink to={{ pathname: `${pluginPath}/${id}`, search }}>{title}</NavLink>
                </NavItem>
              ))}
            </NavList>
          </Nav>
        </PageSection>
      </PageGroup>
      <PageSection hasBodyWrapper={false}>
        <Routes>
          {navItems.map(({ id, component }) => (
            <Route key={id} path={id} element={component} />
          ))}
          <Route path='' element={<Navigate to={{ pathname: 'jfr', search }} replace={true} />} />
        </Routes>
      </PageSection>
    </React.Fragment>
  )
}
