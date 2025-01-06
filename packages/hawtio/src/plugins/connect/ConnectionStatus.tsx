import React, { useEffect, useState } from 'react'
import { connectService, ConnectStatus } from '@hawtiosrc/plugins/shared/connect-service'
import { PluggedIcon, UnpluggedIcon } from '@patternfly/react-icons'
import { Icon } from '@patternfly/react-core'

/**
 * Component to be displayed in HawtioHeaderToolbar for remote connection tabs
 * @constructor
 */
export const ConnectionStatus: React.FunctionComponent = () => {
  const [reachable, setReachable] = useState<ConnectStatus>('not-reachable')
  const [connectionName, setConnectionName] = useState<string | null>(null)
  const [username, setUsername] = useState('')

  useEffect(() => {
    connectService.getCurrentConnectionName().then(name => setConnectionName(name))
    connectService.getCurrentCredentials().then(credentials => {
      const username = credentials ? credentials.username : ''
      setUsername(username)
    })

    const check = async () => {
      const connection = await connectService.getCurrentConnection()
      if (connection) {
        const result = await connectService.checkReachable(connection)
        setReachable(result)
      }
    }
    check() // initial fire
    const timer = setInterval(check, 20000)
    return () => clearInterval(timer)
  }, [])

  let icon = null
  switch (reachable) {
    case 'reachable':
      icon = (
        <Icon status='success'>
          <PluggedIcon />
        </Icon>
      )
      break
    case 'not-reachable':
      icon = (
        <Icon status='danger'>
          <UnpluggedIcon />
        </Icon>
      )
      break
    case 'not-reachable-securely':
      icon = (
        <Icon status='warning'>
          <PluggedIcon />
        </Icon>
      )
      break
  }

  return (
    <React.Fragment>
      {icon} {connectionName && connectionName} {username && `(${username})`}
    </React.Fragment>
  )
}
