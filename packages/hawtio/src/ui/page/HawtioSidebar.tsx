import { Nav, NavItem, NavList, PageSidebar, PageSidebarBody } from '@patternfly/react-core'
import React, { useContext } from 'react'
import { NavLink } from 'react-router'
import { PageContext, useHawtioLocation } from './context'
import './HawtioSideBar.css'

export const HawtioSidebar: React.FunctionComponent = () => {
  const { plugins } = useContext(PageContext)
  // it's important to not call useLocation(), because `search` for the sidebar links should NOT
  // include `nid` parameter (or any other plugin-specific parameters)
  const { pathname, search } = useHawtioLocation()

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
