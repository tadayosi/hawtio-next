import { connectService } from '@hawtiosrc/plugins/shared'
import { humanizeSeconds } from '@hawtiosrc/util/dates'
import { Alert, Button, Form, FormAlert, FormGroup, Modal, TextInput } from '@patternfly/react-core'
import React, { useEffect, useState } from 'react'

export const ConnectLogin: React.FunctionComponent = () => {
  const [isOpen, setIsOpen] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginFailed, setLoginFailed] = useState(false)
  const [loginFailedMessage, setLoginFailedMessage] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [connectionName, setConnectionName] = useState<string | null>(null)

  useEffect(() => {
    connectService.getCurrentConnectionName().then(name => setConnectionName(name))
  }, [])

  if (!connectionName) {
    return null
  }

  const reset = () => {
    setLoginFailed(false)
    setLoginFailedMessage('')
    setIsEnabled(true)
  }

  const handleLogin = () => {
    const login = async () => {
      const result = await connectService.login(username, password)
      switch (result.type) {
        case 'success':
          // successful login at this page will finally stop <HawtioPage>
          // making client-redirects
          sessionStorage.removeItem('connect-login-redirect')
          setLoginFailed(false)
          // Redirect to the original URL
          connectService.redirect()
          break
        case 'failure':
          setLoginFailed(true)
          setLoginFailedMessage('Incorrect username or password')
          break
        case 'session-expired':
          setLoginFailed(true)
          setLoginFailedMessage('Session expired. Re-login in main window.')
          break
        case 'throttled': {
          const { retryAfter } = result
          setLoginFailed(true)
          setLoginFailedMessage(`Login attempt blocked. Retry after ${humanizeSeconds(retryAfter)}`)
          setIsEnabled(false)
          setTimeout(reset, retryAfter * 1000)
          break
        }
      }
    }
    login()
  }

  const handleClose = () => {
    setIsOpen(false)
    // Closing login modal should also close the window
    window.close()
  }

  const actions = [
    <Button key='login' variant='primary' onClick={handleLogin} isDisabled={!isEnabled}>
      Log in
    </Button>,
    <Button key='cancel' variant='link' onClick={handleClose}>
      Cancel
    </Button>,
  ]

  const title = `Log in to ${connectionName}`

  return (
    <Modal variant='small' title={title} isOpen={isOpen} onClose={handleClose} actions={actions}>
      <Form id='connect-login-form' isHorizontal onKeyUp={e => e.key === 'Enter' && handleLogin()}>
        {loginFailed && (
          <FormAlert>
            <Alert variant='danger' title={loginFailedMessage} isInline />
          </FormAlert>
        )}
        <FormGroup label='Username' isRequired fieldId='connect-login-form-username'>
          <TextInput
            isRequired
            id='connect-login-form-username'
            name='connect-login-form-username'
            value={username}
            onChange={(_event, value) => setUsername(value)}
            autoFocus={true}
          />
        </FormGroup>
        <FormGroup label='Password' isRequired fieldId='connect-login-form-password'>
          <TextInput
            isRequired
            id='connect-login-form-password'
            name='connect-login-form-password'
            type='password'
            value={password}
            onChange={(_event, value) => setPassword(value)}
          />
        </FormGroup>
      </Form>
    </Modal>
  )
}
