import { Nav, NavItem, NavList, PageSidebar, PageSidebarBody } from '@patternfly/react-core'
import React, { useContext } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { PageContext } from './context'

export const HawtioSidebar: React.FunctionComponent = () => {
  const { plugins } = useContext(PageContext)
  const { pathname, search } = useLocation()

  const pathMatch = (path: string, pluginPath: string) => {
    if (!pluginPath.startsWith('/')) {
      pluginPath = '/' + pluginPath
    }
    return path.startsWith(pluginPath)
  }

  const pageNav = (
    <Nav>
      <NavList>
        {plugins
          .filter(plugin => plugin.path != null)
          .map(plugin => (
            <NavItem key={plugin.id} isActive={pathMatch(pathname, plugin.path!)}>
              <NavLink to={{ pathname: plugin.path!, search }}>{plugin.title}</NavLink>
            </NavItem>
          ))}
      </NavList>
    </Nav>
  )

  return (
    <PageSidebar>
      <PageSidebarBody>{pageNav}</PageSidebarBody>
    </PageSidebar>
  )
}
