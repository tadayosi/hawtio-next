import { default as EventEmitter } from 'eventemitter3'
import { Logger } from './logging'
import React from 'react'

const log = Logger.get('hawtio-core-event')

export type NotificationType = 'info' | 'success' | 'warning' | 'danger' | 'custom'

export type Notification = {
  type: NotificationType
  message: React.ReactNode
  duration?: number
}

export type EventListener = () => void
export type NotificationListener = (notification: Notification) => void

export type HawtioEvent = 'notify' | 'login' | 'logout' | 'refresh' | 'pluginsUpdated'

export const EVENT_NOTIFY: HawtioEvent = 'notify'
export const EVENT_LOGIN: HawtioEvent = 'login'
export const EVENT_LOGOUT: HawtioEvent = 'logout'
export const EVENT_REFRESH: HawtioEvent = 'refresh'
export const EVENT_PLUGINS_UPDATED: HawtioEvent = 'pluginsUpdated'

const DEFAULT_DURATION = 8000

export interface IEventService {
  notify(notification: Notification): void
  onNotify(listener: NotificationListener): void

  login(): void
  onLogin(listener: EventListener): void

  logout(): void
  onLogout(listener: EventListener): void

  refresh(): void
  onRefresh(listener: EventListener): void

  pluginsUpdated(): void
  onPluginsUpdated(listener: EventListener): void

  removeListener(event: HawtioEvent, listener: EventListener | NotificationListener): void
}

class EventService implements IEventService {
  private eventEmitter = new EventEmitter()

  notify(notification: Notification) {
    if (!notification.duration) {
      notification.duration = DEFAULT_DURATION
    }
    this.eventEmitter.emit(EVENT_NOTIFY, notification)
  }

  onNotify(listener: NotificationListener) {
    this.eventEmitter.on(EVENT_NOTIFY, listener)
    log.debug('Number of listeners on', EVENT_NOTIFY, '=', this.eventEmitter.listenerCount(EVENT_NOTIFY))
  }

  login() {
    this.eventEmitter.emit(EVENT_LOGIN)
  }

  onLogin(listener: EventListener) {
    this.eventEmitter.on(EVENT_LOGIN, listener)
  }

  logout() {
    this.eventEmitter.emit(EVENT_LOGOUT)
  }

  onLogout(listener: EventListener) {
    this.eventEmitter.on(EVENT_LOGOUT, listener)
  }

  refresh() {
    this.eventEmitter.emit(EVENT_REFRESH)
  }

  onRefresh(listener: EventListener) {
    this.eventEmitter.on(EVENT_REFRESH, listener)
  }

  pluginsUpdated() {
    this.eventEmitter.emit(EVENT_PLUGINS_UPDATED)
  }

  onPluginsUpdated(listener: EventListener) {
    this.eventEmitter.on(EVENT_PLUGINS_UPDATED, listener)
  }

  removeListener(event: HawtioEvent, listener: EventListener | NotificationListener) {
    this.eventEmitter.removeListener(event, listener)
  }
}

export const eventService = new EventService()
