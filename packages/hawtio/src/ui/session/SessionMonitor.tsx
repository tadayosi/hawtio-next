import React, { useEffect, useState } from 'react'
import { Button } from '@patternfly/react-core'
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated'
import { userService } from '@hawtiosrc/auth'
import { sessionService } from './session-service'

export const SessionMonitor: React.FunctionComponent = () => {
  // state for alert dialog
  const [sessionAlertVisible, setSessionAlertVisible] = useState(false)
  // state for time till (server-side) session end. When -1, we don't track session
  const [time, setTime] = useState(-1)
  const [configured, setConfigured] = useState(false)

  // configuration effect (no deps)
  useEffect(() => {
    // 1. get session config and if there's session activity timeout, start a ticker which updates "time" state
    let ticker: NodeJS.Timeout | null = null
    // run immediate timeout, so we can use await
    const configureSession = setTimeout(async () => {
      await sessionService.configReady()
      const sessionTimeout = sessionService.getSessionTimeout()
      if (sessionTimeout > 0) {
        setTime(sessionTimeout)
        setConfigured(true)
        // a ticker that'll decrease time-left and store it in this component's state
        ticker = setInterval(() => {
          if (sessionService.shouldResetTimer()) {
            // user activity caused an extra refresh, so we can restart counting
            setTime(sessionService.getSessionTimeout())
            sessionService.clearResetTimerFlag()
          } else {
            setTime(v => {
              return v > 0 ? v - 1 : v
            })
          }
        }, 1000)
      }
    }, 0)
    // 2. setup a refresh which runs every 5 seconds. If there was recent user activity, server ping will be sent
    const periodicalRefresh = setInterval(async () => {
      if (sessionService.updateSession()) {
        setTime(sessionService.getSessionTimeout())
      }
    }, 5000)

    return () => {
      clearTimeout(configureSession)
      if (ticker != null) {
        clearInterval(ticker)
      }
      clearInterval(periodicalRefresh)
    }
  }, [])

  // effect to:
  //  - show dialog when time comes
  //  - logout the user when session ends
  //  - reset the timer, when session was just refreshed by some user activity
  useEffect(() => {
    if (!configured) {
      return
    }
    if (sessionService.sessionEnding(time)) {
      sessionService.setRefresh(false)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionAlertVisible(true)
    }
    if (sessionService.sessionEnded(time)) {
      setTimeout(() => {
        userService.logout()
      }, 1000)
    }
  }, [time, configured])

  // called when user closes the alert dialog. Session should be kept alive
  const keepSessionAlive = () => {
    setSessionAlertVisible(false)
    sessionService.setRefresh(true)
    sessionService.updateSession()
    setTime(sessionService.getSessionTimeout())
  }

  return (
    <React.Fragment>
      <Modal
        isOpen={sessionAlertVisible}
        variant={ModalVariant.small}
        title='Session expires soon'
        onClose={keepSessionAlive}
        actions={[
          <Button key='continue' onClick={keepSessionAlive}>
            Stay connected
          </Button>,
        ]}
      >
        <div>{time > 0 ? 'Session expires in ' + time + ' second' + (time == 1 ? '.' : 's.') : 'Logging out...'}</div>
      </Modal>
    </React.Fragment>
  )
}
