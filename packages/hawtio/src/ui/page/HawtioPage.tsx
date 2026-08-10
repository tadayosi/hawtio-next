import { useUser } from '@hawtiosrc/auth/hooks'
import { useHawtconfig, usePlugins } from '@hawtiosrc/core'
import { HawtioHelp } from '@hawtiosrc/help/ui'
import { PluginNodeSelectionContext, usePluginNodeSelected } from '@hawtiosrc/plugins'
import { preferencesService } from '@hawtiosrc/preferences/preferences-service'
import { HawtioPreferences } from '@hawtiosrc/preferences/ui'
import { HawtioNotification } from '@hawtiosrc/ui/notification'
import { SessionMonitor, sessionService } from '@hawtiosrc/ui/session'
import { EmptyState, Page, PageSection } from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon'
import React, { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'
import { HawtioHeader } from './HawtioHeader'
import { HawtioLoadingPage } from './HawtioLoadingPage'
import './HawtioPage.css'
import { HawtioSidebar } from './HawtioSidebar'
import { PageContext, useHawtioLocation } from './context'
import { log } from './globals'

/**
 * One of the two _main_ components to be displayed in `<Hawtio>` component. It is displayed when user is logged in.
 */
export const HawtioPage: React.FunctionComponent = () => {
  // static information, fetched only during Hawtio initialization
  const { hawtconfig, hawtconfigLoaded } = useHawtconfig()
  const { plugins, pluginsLoaded } = usePlugins()
  // useUser also returns static information, because user login and logout always end with page reload
  const { username, isLogin, userLoaded, loginMethod } = useUser()

  // Historically, Hawtio was always showing a JMX tree of the underlying server-side Java application.
  // Which is the reason why the "currently selected node" is so high in the component hierarchy.
  // this could be made more generic:
  // - "node" may not be an actual tree node, but some selected UI fragment/item of any plugin
  // - there could be more "current" selected items
  // - there should be no conflicts between current items when more plugins have such concept
  // But for now, HawtioPage provides context for the selected MBean node to be shared by specific plugins
  // like Jmx or Camel. These plugins may render and access the workspace's tree. Having the selected node above
  // the tree allows to preserve the selected node when user navigates back and forth between different plugins.
  const { selectedNode, setSelectedNode } = usePluginNodeSelected()

  // hooks of React Router
  const navigate = useNavigate()
  // useHawtioLocation() wraps useLocation(), where "search" does not include plugin-specific query parameters
  const { search, fullSearch } = useHawtioLocation()

  // navigate should be used in effect
  // otherwise "Cannot update a component (`BrowserRouter`) while rendering a different component" is thrown
  useEffect(() => {
    if (!isLogin && userLoaded) {
      navigate({ pathname: '/login', search })
    }
  }, [isLogin, userLoaded, navigate, search])

  if (!isLogin || !userLoaded || !pluginsLoaded || !hawtconfigLoaded) {
    return <HawtioLoadingPage />
  }

  log.debug(`Login state: username = ${username}, isLogin = ${isLogin}`)

  // First plugin that has a path and a component to display will be the one displayed at "home" page
  const defaultPlugin = plugins.find(p => p && p.path && p.component)
  let defaultPage = defaultPlugin ? <Navigate to={{ pathname: defaultPlugin.path, search }} replace={true} /> : <HawtioHome />

  // If a plugin that uses complex authentication flow involving redirects is active and in the process
  // of redirection, Hawtio will properly navigate
  const loginRedirect = sessionStorage.getItem('connect-login-redirect')
  if (loginRedirect) {
    // this is required for OIDC, because we can't have redirect_uri with
    // wildcard on EntraID...
    // this session storage item is removed after successful login at connect/login page
    defaultPage = <Navigate to={{ pathname: loginRedirect, search: fullSearch }} replace={true} />
  }

  // If not defined then assume the default of shown
  const headerShown = hawtconfig.appearance?.showHeader ?? true
  const sideBarShown = hawtconfig.appearance?.showSideBar ?? true

  // clicking anywhere in the page will keep the session alive. It's not costly, as the server requests are sent
  // every few seconds only
  const keepAlive = () => {
    sessionService.userActivity()
  }

  // The main Hawtio application for authenticated user. There's an optional top and side bar and the Page
  // with React Router routes for each plugin that has a path and component defined
  // It is important that the routes are always using `/*` suffix, so the subnavigation works correctly - then
  // the plugins may use nested <Routes> elements.
  return (
    <PageContext.Provider value={{ username, plugins }}>
      <Page
        id='hawtio-main-page'
        mainContainerId='hawtio-main-container'
        masthead={headerShown && <HawtioHeader loginMethod={loginMethod} />}
        sidebar={sideBarShown && <HawtioSidebar />}
        isManagedSidebar={sideBarShown}
        defaultManagedSidebarIsOpen={preferencesService.isShowVerticalNavByDefault()}
        onClick={keepAlive}
      >
        {/* Top-level context provider for handling selected node shared between the plugins */}
        <PluginNodeSelectionContext.Provider value={{ selectedNode, setSelectedNode }}>
          <Routes>
            {/* plugins */}
            {plugins
              .filter(plugin => plugin.path != null && plugin.component != null)
              .map(plugin => (
                <Route key={plugin.id} path={`${plugin.path}/*`} Component={plugin.component!} />
              ))}
            <Route key='help' path='/help/*' Component={HawtioHelp} />
            <Route key='preferences' path='/preferences/*' Component={HawtioPreferences} />
            {/* This route removes old-school index.html displayed in the URL bar */}
            <Route key='index' path='index.html' element={<Navigate to={{ pathname: '/', search }} replace={true} />} />
            <Route key='root' path='' element={defaultPage} />
          </Routes>
        </PluginNodeSelectionContext.Provider>
        <HawtioNotification />
        <SessionMonitor />
      </Page>
    </PageContext.Provider>
  )
}

/**
 * A component displayed if there's no plugin that can provide the component to be displayed
 *
 * @constructor
 */
const HawtioHome: React.FunctionComponent = () => (
  <PageSection hasBodyWrapper={false}>
    <EmptyState headingLevel='h1' icon={CubesIcon} titleText='Hawtio' variant='full' />
  </PageSection>
)
