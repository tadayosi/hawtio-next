import { hawtio } from '@hawtio/react/core'
import { toString } from '@hawtio/react/util/strings'
import { joinPaths } from '@hawtio/react/util/urls'
import Jolokia, { IJolokia } from 'jolokia.js'
import { Connection, Connections } from './connections'
import { log } from './globals'

export type ConnectionTestResult = {
  ok: boolean
  message: string
}

const STORAGE_KEY_CONNECTIONS = 'connect.connections'
const SESSION_KEY_CURRENT_CONNECTION = 'connect.currentConnection'

export const PARAM_KEY_CONNECTION = 'con'

export interface IConnectService {
  getCurrentConnectionName(): string | null
  getCurrentConnection(): Connection | null
  loadConnections(): Connections
  saveConnections(connections: Connections): void
  getConnection(name: string): Connection | null
  connectionToUrl(connection: Connection): string
  checkReachable(connection: Connection): Promise<boolean>
  testConnection(connection: Connection): Promise<ConnectionTestResult>
  connect(connection: Connection): void
  getJolokiaUrl(connection: Connection): string
  getJolokiaUrlFromName(name: string): string | null
  export(connections: Connections): void
}

class ConnectService implements IConnectService {
  private currentConnection: string | null

  constructor() {
    this.currentConnection = this.initCurrentConnection()
  }

  private initCurrentConnection(): string | null {
    // Check remote connection from URL query param
    const url = new URL(window.location.href)
    const searchParams = url.searchParams
    log.debug('Checking search params:', searchParams.toString())
    let conn = searchParams.get(PARAM_KEY_CONNECTION)
    if (conn) {
      sessionStorage.setItem(SESSION_KEY_CURRENT_CONNECTION, JSON.stringify(conn))
      return conn
    }

    // Check remote connection from session storage
    conn = sessionStorage.getItem(SESSION_KEY_CURRENT_CONNECTION)
    return conn ? JSON.parse(conn) : null
  }

  getCurrentConnectionName(): string | null {
    return this.currentConnection
  }

  getCurrentConnection(): Connection | null {
    return this.currentConnection ? this.getConnection(this.currentConnection) : null
  }

  loadConnections(): Connections {
    const conns = localStorage.getItem(STORAGE_KEY_CONNECTIONS)
    return conns ? JSON.parse(conns) : {}
  }

  saveConnections(connections: Connections) {
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections))
  }

  getConnection(name: string): Connection | null {
    const connections = this.loadConnections()
    return connections[name]
  }

  connectionToUrl(connection: Connection): string {
    let url = `${connection.scheme}://${connection.host}:${connection.port}`
    if (!connection.path.startsWith('/')) {
      url += '/'
    }
    url += connection.path
    return url
  }

  async checkReachable(connection: Connection): Promise<boolean> {
    const result = await this.testConnection(connection)
    return result.ok
  }

  testConnection(connection: Connection): Promise<ConnectionTestResult> {
    log.debug('Testing connection:', toString(connection))
    return new Promise<ConnectionTestResult>((resolve, reject) => {
      try {
        this.createJolokia(connection).request(
          { type: 'version' },
          {
            success: () => {
              resolve({ ok: true, message: 'Connection successful' })
            },
            ajaxError: (response: JQueryXHR) => {
              switch (response.status) {
                case 401:
                  resolve({ ok: true, message: 'Connection successful' })
                  break
                case 403:
                  if (this.forbiddenReasonMatches(response, 'HOST_NOT_ALLOWED')) {
                    resolve({ ok: false, message: 'Host not allowlisted' })
                  } else {
                    resolve({ ok: true, message: 'Connection successful' })
                  }
                  break
                default:
                  resolve({ ok: false, message: 'Connection failed' })
              }
            },
          },
        )
      } catch (error) {
        log.error(error)
        reject(error)
      }
    })
  }

  connect(connection: Connection) {
    log.debug('Connecting with options:', toString(connection))
    const basepath = hawtio.getBasePath() || '/'
    const url = `${basepath}?${PARAM_KEY_CONNECTION}=${connection.name}`
    log.debug('Opening URL:', url)
    window.open(url)
  }

  /**
   * Create a Jolokia instance with the given connection.
   */
  private createJolokia(connection: Connection, checkCredentials = false): IJolokia {
    if (checkCredentials) {
      return new Jolokia({
        url: this.getJolokiaUrl(connection),
        method: 'post',
        mimeType: 'application/json',
        username: connection.username,
        password: connection.password,
      })
    }

    return new Jolokia({
      url: this.getJolokiaUrl(connection),
      method: 'post',
      mimeType: 'application/json',
    })
  }

  /**
   * Get the Jolokia URL for the given connection.
   */
  getJolokiaUrl(connection: Connection): string {
    log.debug('Connect to server with connection:', toString(connection))
    if (connection.jolokiaUrl) {
      log.debug('Using provided URL:', connection.jolokiaUrl)
      return connection.jolokiaUrl
    }

    // TODO: Better handling of doc base and proxy URL construction
    const url = joinPaths(
      '/proxy',
      connection.scheme || 'http',
      connection.host || 'localhost',
      String(connection.port || 80),
      connection.path,
    )
    log.debug('Using URL:', url)
    return url
  }

  /**
   * Get the Jolokia URL for the given connection name.
   */
  getJolokiaUrlFromName(name: string): string | null {
    const connection = this.getConnection(name)
    return connection ? this.getJolokiaUrl(connection) : null
  }

  private forbiddenReasonMatches(response: JQueryXHR, reason: string): boolean {
    // Preserve compatibility with versions of Hawtio 2.x that return JSON on 403 responses
    if (response.responseJSON && response.responseJSON['reason']) {
      return response.responseJSON['reason'] === reason
    }
    // Otherwise expect a response header containing a forbidden reason
    return response.getResponseHeader('Hawtio-Forbidden-Reason') === reason
  }

  export(connections: Connections) {
    const content = JSON.stringify(Object.values(connections), null, '  ')
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hawtio-connections-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export const connectService = new ConnectService()
