import { humanizeSeconds } from '@hawtiosrc/util/dates'
import { LoginForm, LoginFormProps } from '@patternfly/react-core'
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon'
import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { log } from './globals'
import { loginService } from './login-service'
import { FormAuthenticationMethod } from '@hawtiosrc/core'

export const HawtioLoginForm: React.FunctionComponent<{ method: FormAuthenticationMethod }> = ({ method }) => {
  const navigate = useNavigate()
  const { search } = useLocation()

  let loginFailedInitialMessage = ''
  let loginFailedInitial = false
  if (window.location.hash && window.location.hash.length > 0) {
    const urlHash = new URLSearchParams(window.location.hash.substring(1))
    if (urlHash?.has('noauth')) {
      loginFailedInitialMessage = 'Invalid login credentials'
      loginFailedInitial = true
    }
  }

  const [username, setUsername] = useState(loginService.getUser())
  const [isValidUsername, setIsValidUsername] = useState(!loginFailedInitial)
  const [password, setPassword] = useState('')
  const [isValidPassword, setIsValidPassword] = useState(true)
  const [rememberMe, setRememberMe] = useState(username !== '')
  const [loginFailed, setLoginFailed] = useState(loginFailedInitial)
  const [loginFailedMessage, setLoginFailedMessage] = useState(loginFailedInitialMessage)
  const [isEnabled, setIsEnabled] = useState(true)

  log.debug('Login state: username =', username)

  const reset = () => {
    setIsValidUsername(true)
    setIsValidPassword(true)
    setLoginFailed(false)
    setLoginFailedMessage('')
    setIsEnabled(true)
  }

  const doLogin: LoginFormProps['onLoginButtonClick'] = event => {
    event.preventDefault()
    reset()
    let invalid = false
    if (username.trim() === '') {
      setIsValidUsername(false)
      setLoginFailed(true)
      invalid = true
    }
    if (password === '') {
      setIsValidPassword(false)
      setLoginFailed(true)
      invalid = true
    }
    if (invalid) {
      setLoginFailedMessage('Username/password should not be empty')
      return
    }

    loginService.login(username, password, rememberMe, method as FormAuthenticationMethod).then(result => {
      switch (result.type) {
        case 'success':
          navigate({ pathname: '/', search })
          // Reload page to force initialising Jolokia service
          navigate(0)
          break
        case 'failure':
          setLoginFailed(true)
          setLoginFailedMessage('Invalid login credentials')
          setIsValidUsername(false)
          setIsValidPassword(false)
          break
        case 'throttled': {
          const { retryAfter } = result
          setLoginFailed(true)
          setLoginFailedMessage(`Login attempt blocked. Retry after ${humanizeSeconds(retryAfter)}`)
          setIsValidUsername(false)
          setIsValidPassword(false)
          setIsEnabled(false)
          setTimeout(reset, retryAfter * 1000)
          break
        }
      }
    })
  }

  const rememberMeLabel = 'Remember username'

  return (
    <LoginForm
      noAutoFocus={true}
      showHelperText={loginFailed}
      helperText={loginFailedMessage}
      helperTextIcon={<ExclamationCircleIcon />}
      usernameLabel='Username'
      usernameValue={username}
      onChangeUsername={(_event, val) => setUsername(val)}
      isValidUsername={isValidUsername}
      passwordLabel='Password'
      passwordValue={password}
      onChangePassword={(_event, val) => setPassword(val)}
      isValidPassword={isValidPassword}
      rememberMeLabel={rememberMeLabel}
      isRememberMeChecked={rememberMe}
      onChangeRememberMe={() => setRememberMe(!rememberMe)}
      onLoginButtonClick={doLogin}
      loginButtonLabel='Log in'
      isLoginButtonDisabled={!isEnabled}
    />
  )
}
