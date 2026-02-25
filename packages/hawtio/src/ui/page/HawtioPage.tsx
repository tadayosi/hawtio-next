import { useUser } from '@hawtiosrc/auth/hooks'
import { useHawtconfig, usePlugins } from '@hawtiosrc/core'
import { HawtioHelp } from '@hawtiosrc/help/ui'
import { background } from '@hawtiosrc/img'
import { PluginNodeSelectionContext, usePluginNodeSelected } from '@hawtiosrc/plugins'
import { preferencesService } from '@hawtiosrc/preferences/preferences-service'
import { HawtioPreferences } from '@hawtiosrc/preferences/ui'
import { HawtioNotification } from '@hawtiosrc/ui/notification'
import { SessionMonitor, sessionService } from '@hawtiosrc/ui/session'
import { BackgroundImage, EmptyState, Page, PageSection } from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon'
import React, { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { HawtioHeader } from './HawtioHeader'
import { HawtioLoadingPage } from './HawtioLoadingPage'
import './HawtioPage.css'
import { HawtioSidebar } from './HawtioSidebar'
import { PageContext } from './context'
import { KNOWN_COMMON_QUERY_PARAMS, log } from './globals'

/**
 * One of two _main_ components to be displayed in `<Hawtio>` component. It is displayed when user is logged in.
 */
export const HawtioPage: React.FunctionComponent = () => {
  const { username, isLogin, userLoaded, loginMethod } = useUser()
  const { plugins, pluginsLoaded } = usePlugins()
  const { hawtconfig, hawtconfigLoaded } = useHawtconfig()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedNode, setSelectedNode } = usePluginNodeSelected()

  // navigate should be used in effect
  // otherwise "Cannot update a component (`BrowserRouter`) while rendering a different component" is thrown
  useEffect(() => {
    if (!isLogin && userLoaded) {
      navigate({ pathname: '/login', search })
    }
  }, [isLogin, userLoaded, navigate])

  // Centrally update the URL query parameters to remove any unknown parameters
  // that may exist in the URL before the flow proceeds to each plugin's view.
  useEffect(() => {
    if (!pluginsLoaded) {
      return
    }

    const plugin = plugins.find(p => p.path && pathname.startsWith(p.path))
    if (!plugin) {
      return
    }
    const knownParams = new Set([...KNOWN_COMMON_QUERY_PARAMS, ...(plugin.knownQueryParams ?? [])])
    searchParams.forEach((_, key) => !knownParams.has(key) && searchParams.delete(key))
    setSearchParams(searchParams)
  }, [plugins, pluginsLoaded, pathname, searchParams, setSearchParams])

  if (!isLogin || !userLoaded || !pluginsLoaded || !hawtconfigLoaded) {
    return <HawtioLoadingPage />
  }

  log.debug(`Login state: username = ${username}, isLogin = ${isLogin}`)

  const defaultPlugin = plugins[0] ?? null
  let defaultPage = defaultPlugin ? <Navigate to={{ pathname: defaultPlugin.path, search }} /> : <HawtioHome />
  const loginRedirect = sessionStorage.getItem('connect-login-redirect')
  if (loginRedirect) {
    // this is required for OIDC, because we can't have redirect_uri with
    // wildcard on EntraID...
    // this session storage item is removed after successful login at connect/login page
    defaultPage = <Navigate to={{ pathname: loginRedirect, search }} />
  }

  const showVerticalNavByDefault = preferencesService.isShowVerticalNavByDefault()

  const keepAlive = () => {
    sessionService.userActivity()
  }

  // If not defined then assume the default of shown
  const headerShown = hawtconfig.appearance?.showHeader ?? true
  const sideBarShown = hawtconfig.appearance?.showSideBar ?? true

  return (
    <PageContext.Provider value={{ username, plugins }}>
      <BackgroundImage src={background} />
      <Page
        id='hawtio-main-page'
        mainContainerId='hawtio-main-container'
        masthead={headerShown && <HawtioHeader loginMethod={loginMethod} />}
        sidebar={sideBarShown && <HawtioSidebar />}
        isManagedSidebar={sideBarShown}
        defaultManagedSidebarIsOpen={showVerticalNavByDefault}
        onClick={keepAlive}
      >
        {/* Provider for handling selected node shared between the plugins */}
        <PluginNodeSelectionContext.Provider value={{ selectedNode, setSelectedNode }}>
          <Routes>
            {/* plugins */}
            {plugins
              .filter(plugin => plugin.path != null && plugin.component != null)
              .map(plugin => {
                const component = React.createElement(plugin.component!)
                return (
                  <Route key={plugin.id} path={plugin.path} element={component}>
                    <Route path='*' element={component} />
                  </Route>
                )
              })}
            <Route key='help' path='/help' element={<HawtioHelp />}>
              <Route path='*' element={<HawtioHelp />} />
            </Route>
            <Route key='preferences' path='/preferences' element={<HawtioPreferences />}>
              <Route path='*' element={<HawtioPreferences />} />
            </Route>
            <Route key='index' path='index.html' element={<Navigate to={{ pathname: '/', search }} />} />
            <Route key='root' index element={defaultPage} />
          </Routes>
        </PluginNodeSelectionContext.Provider>
        <HawtioNotification />
        <SessionMonitor />
      </Page>
    </PageContext.Provider>
  )
}

const HawtioHome: React.FunctionComponent = () => (
  <PageSection hasBodyWrapper={false}>
    <EmptyState headingLevel='h1' icon={CubesIcon} titleText='Hawtio' variant='full' />
  </PageSection>
)
