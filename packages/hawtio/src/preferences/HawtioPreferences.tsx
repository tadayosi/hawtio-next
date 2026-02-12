import { helpRegistry } from '@hawtiosrc/help/registry'
import { Nav, NavItem, NavList, PageSection, Title } from '@patternfly/react-core'
import React from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import help from './help.md'
import { HomePreferences } from './HomePreferences'
import { LogsPreferences } from './LogsPreferences'
import { preferencesRegistry } from './registry'

helpRegistry.add('preferences', 'Preferences', help, 2)
preferencesRegistry.add('home', 'Home', HomePreferences, 1)
preferencesRegistry.add('console-logs', 'Console Logs', LogsPreferences, 2)

export const HawtioPreferences: React.FunctionComponent = () => {
  const { pathname, search } = useLocation()
  return (
    <React.Fragment>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel='h1'>Preferences</Title>
      </PageSection>
      <PageSection type='tabs' hasBodyWrapper={false}>
        <Nav aria-label='Preferences Nav' variant='horizontal-subnav'>
          <NavList>
            {preferencesRegistry.getPreferences().map(({ id, title }) => (
              <NavItem key={id} isActive={pathname === `/preferences/${id}`}>
                <NavLink to={{ pathname: id, search }}>{title}</NavLink>
              </NavItem>
            ))}
          </NavList>
        </Nav>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Routes>
          {preferencesRegistry.getPreferences().map(({ id, component }) => (
            <Route key={id} path={id} element={React.createElement(component)} />
          ))}
          <Route path='/' element={<Navigate to={{ pathname: 'home', search }} />} />
        </Routes>
      </PageSection>
    </React.Fragment>
  )
}
