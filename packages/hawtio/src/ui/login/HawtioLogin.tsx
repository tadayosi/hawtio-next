import { useUser } from '@hawtiosrc/auth/hooks'
import {
  AuthenticationMethod,
  AuthenticationResult,
  configManager,
  DEFAULT_APP_NAME,
  DEFAULT_LOGIN_TITLE,
  FormAuthenticationMethod,
  useHawtconfig,
  usePlugins,
} from '@hawtiosrc/core'
import { background, hawtioLogo } from '@hawtiosrc/img'
import { HawtioNotification } from '@hawtiosrc/ui/notification'
import { HawtioLoadingPage } from '@hawtiosrc/ui/page'
import { Alert, Button, ListItem, ListVariant, LoginFooterItem, LoginPage } from '@patternfly/react-core'
import React, { ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { HawtioLoginForm } from './HawtioLoginForm'
import { log } from './globals'

/**
 * One of two _main_ components to be displayed in `<Hawtio>` component. It is displayed when user is not logged in.
 */
export const HawtioLogin: React.FunctionComponent = () => {
  const navigate = useNavigate()

  let loginFailedInitialMessage = ''
  if (sessionStorage.getItem('logout.reason')) {
    loginFailedInitialMessage = sessionStorage.getItem('logout.reason')!
  }

  const { isLogin, userLoaded, isLoginError, loginError: loginErrorMessage } = useUser()
  const { hawtconfig, hawtconfigLoaded } = useHawtconfig()
  const { plugins, pluginsLoaded } = usePlugins()
  const [authenticationMethods, setAuthenticationMethods] = useState<AuthenticationMethod[]>([])
  const [authenticationMethodSelected, setAuthenticationMethodSelected] = useState(-1)
  const [authenticationMethodsLoaded, setAuthenticationMethodsLoaded] = useState(false)
  const [loginError, setLoginError] = useState(loginFailedInitialMessage)

  useEffect(() => {
    if (isLogin) {
      navigate('/')
    } else if (isLoginError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoginError(loginErrorMessage)
    }
  }, [isLogin, navigate, isLoginError, loginErrorMessage])

  useEffect(() => {
    const methods = configManager.getAuthenticationConfig()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthenticationMethods(methods)
    setAuthenticationMethodsLoaded(true)
  }, [])

  if (isLogin || !userLoaded || !hawtconfigLoaded || !pluginsLoaded || !authenticationMethodsLoaded) {
    return <HawtioLoadingPage />
  }

  /**
   * Prepares a React component to handle given `AuthenticationMethod`
   * @param method
   * @param multi
   * @param idx
   */
  const configureLoginFragment = (method: AuthenticationMethod, multi: boolean, idx: number): ReactNode => {
    let oidcComponent = null
    if (method.method === 'oidc' || method.method === 'keycloak') {
      // same for multi and single selection
      oidcComponent = (
        <Button
          component='a'
          variant='secondary'
          size='sm'
          isBlock
          className='idp'
          onClick={async () => {
            const loginMethod = configManager.getAuthenticationMethod(method.method, method.position ?? 0)?.login
            let ok
            let result
            if (!loginMethod) {
              result = AuthenticationResult.configuration_error
              ok = false
            } else {
              result = await loginMethod()
              ok = result === AuthenticationResult.ok
            }
            if (!ok) {
              switch (result) {
                case AuthenticationResult.connect_error:
                  setLoginError(`"${method.method}" plugin error: Connection Error`)
                  break
                case AuthenticationResult.security_context_error:
                  setLoginError(`"${method.method}" plugin error: Insecure Browser Context`)
                  break
                case AuthenticationResult.configuration_error:
                default:
                  setLoginError(`"${method.method}" plugin error: Invalid Configuration`)
                  break
              }
            }
          }}
        >
          {method.name}
        </Button>
      )
    }

    if (multi) {
      if (method.method === 'oidc' || method.method === 'keycloak') {
        // here we don't have to change UI to another button which starts Authorization Flow.
        // we can do it already
        return oidcComponent
      } else if (method.method === 'external') {
        // skip, as this "method" is supported by redirects before reaching Hawtio's index.html
        return null
      } else {
        // a button with onClick that only selects given method
        return (
          <Button
            variant='secondary'
            size='sm'
            isBlock
            className='idp'
            onClick={() => {
              setAuthenticationMethodSelected(idx)
              setLoginError('')
            }}
          >
            {method.name}
          </Button>
        )
      }
    }

    // single component version
    switch (method.method) {
      case 'form':
        // will handle login using loginService
        return <HawtioLoginForm method={method as FormAuthenticationMethod} />
      case 'oidc':
      case 'keycloak':
        // already prepared Button with plugin-specific onClick
        return oidcComponent
      case 'basic':
      case 'digest':
      case 'clientcert':
      case 'oauth2':
      default:
        return <div>(Unsupported "{method.method}" authentication)</div>
    }
  }

  // selected Login UI depends on the configuration
  let loginForm

  if (authenticationMethodSelected >= 0) {
    // form is already selected
    loginForm = configureLoginFragment(
      authenticationMethods[authenticationMethodSelected]!,
      false,
      authenticationMethodSelected,
    )
  } else {
    if (authenticationMethods.length == 1) {
      // there's only one option - present method specific UI
      loginForm = configureLoginFragment(authenticationMethods[0]!, false, 0)
    } else {
      // Multiple selection of login methods. user/password forms should use single pair of inputs, but
      // the behaviour should be dependent on the method of choice.
      // OAuth2/OIDC methods should be shown as buttons
      loginForm = (
        <ul>
          {authenticationMethods.map((method, idx) => {
            const form = configureLoginFragment(method, true, idx)
            return form ? <li key={'k' + idx}>{form}</li> : null
          })}
        </ul>
      )
    }
  }

  const loginPlugins = plugins.filter(plugin => plugin.isLogin)
  log.debug('Discovered Login Plugins:', loginPlugins.length)

  if (loginPlugins.length > 0) {
    log.debug('Found Login Plugins ... Customising the Login Page')

    const loginPlugin = loginPlugins[0]
    const component = loginPlugin?.component
    if (component) {
      log.debug('Building with customised login form component')
      loginForm = React.createElement(component)
    }
  }

  const appLogo = hawtconfig.branding?.appLogoUrl ?? hawtioLogo
  const appName = hawtconfig.branding?.appName ?? DEFAULT_APP_NAME
  const description = hawtconfig.login?.description ?? ''
  const links = hawtconfig.login?.links ?? []
  const title = hawtconfig.login?.title ?? DEFAULT_LOGIN_TITLE

  const footerLinks = (
    <React.Fragment>
      {links.map((link, index) => (
        <ListItem key={`footer-link-${index}`}>
          <LoginFooterItem href={link.url}>{link.text}</LoginFooterItem>
        </ListItem>
      ))}
    </React.Fragment>
  )

  const forgotCredentials =
    authenticationMethodSelected == -1 || authenticationMethods.length <= 1 ? null : (
      <Button
        variant='link'
        isInline
        onClick={() => {
          setAuthenticationMethodSelected(-1)
          setLoginError('')
        }}
      >
        Select different authentication method
      </Button>
    )

  return (
    <LoginPage
      backgroundImgSrc={background}
      brandImgSrc={appLogo}
      brandImgAlt={appName}
      loginTitle={title}
      textContent={description}
      footerListItems={footerLinks}
      footerListVariants={ListVariant.inline}
      forgotCredentials={forgotCredentials}
    >
      {loginForm}
      {loginError !== '' ? <Alert variant='danger' isPlain isInline title={loginError} /> : null}
      <HawtioNotification />
    </LoginPage>
  )
}
