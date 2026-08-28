import { eventService, EVENT_NOTIFY, Notification, NotificationType } from '@hawtiosrc/core'
import { Alert, AlertActionCloseButton, AlertGroup, AlertProps } from '@patternfly/react-core'
import React, { useCallback, useEffect, useState } from 'react'

const MAX_ALERTS_TO_DISPLAY = 5

export const HawtioNotification: React.FunctionComponent = () => {
  const [alerts, setAlerts] = useState<Partial<AlertProps>[]>([])
  const [overflowMessage, setOverflowMessage] = useState('')
  const [maxDisplayed, setMaxDisplayed] = useState(MAX_ALERTS_TO_DISPLAY)

  const getOverflowMessage = useCallback(
    (alertsNumber: number) => {
      const overflow = alertsNumber - maxDisplayed
      return overflow > 0 ? `View ${overflow} more alerts` : ''
    },
    [maxDisplayed],
  )

  const addAlert = useCallback(
    (title: React.ReactNode, variant: NotificationType, key: React.Key) => {
      const newAlerts = [...alerts, { title, variant, key }]
      setAlerts(newAlerts)
      setOverflowMessage(getOverflowMessage(newAlerts.length))
      // reset max displayed every time a new alert is added
      setMaxDisplayed(MAX_ALERTS_TO_DISPLAY)
    },
    [alerts, getOverflowMessage],
  )

  const removeAlert = useCallback(
    (key: React.Key) => {
      const newAlerts = alerts.filter(alert => alert.key !== key)
      setAlerts(newAlerts)
      setOverflowMessage(getOverflowMessage(newAlerts.length))
      // reset max displayed every time an alert is removed
      setMaxDisplayed(MAX_ALERTS_TO_DISPLAY)
    },
    [alerts, getOverflowMessage],
  )

  const getUniqueKey = () => new Date().getTime()

  useEffect(() => {
    const listener = (notification: Notification) => {
      const key = getUniqueKey()
      addAlert(notification.message, notification.type, key)
      if (notification.duration) {
        setTimeout(() => {
          removeAlert(key)
        }, notification.duration)
      }
    }
    eventService.onNotify(listener)

    return () => eventService.removeListener(EVENT_NOTIFY, listener)
  }, [addAlert, removeAlert])

  const onOverflowClick = () => {
    setMaxDisplayed(alerts.length)
    setOverflowMessage('')
  }

  return (
    <AlertGroup isToast isLiveRegion onOverflowClick={onOverflowClick} overflowMessage={overflowMessage}>
      {alerts.slice(0, maxDisplayed).map(({ key, variant, title }) => (
        <Alert
          variant={variant}
          title={title}
          actionClose={
            <AlertActionCloseButton
              title={title as string}
              variantLabel={`${variant} alert`}
              onClose={() => key && removeAlert(key)}
            />
          }
          key={key}
        />
      ))}
    </AlertGroup>
  )
}
