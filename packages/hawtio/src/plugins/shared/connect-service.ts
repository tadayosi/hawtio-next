import { eventService, hawtio } from '@hawtiosrc/core'
import { decrypt, encrypt, generateKey, toBase64, toByteArray } from '@hawtiosrc/util/crypto'
import { basicAuthHeaderValue, getCookie } from '@hawtiosrc/util/https'
import { toString } from '@hawtiosrc/util/strings'
import { joinPaths } from '@hawtiosrc/util/urls'
import Jolokia, { IJolokiaSimple } from '@jolokia.js/simple'
import { log } from './globals'

export type Connections = {
  // key is ID, not name, so we can alter the name
  [key: string]: Connection
}

export type Connection = {
  id: string
  name: string
  scheme: 'http' | 'https'
  host: string
  port: number
  path: string

  jolokiaUrl?: string
  username?: string
  password?: string
}

export const INITIAL_CONNECTION: Connection = {
  id: '',
  name: '',
  scheme: 'https',
  host: 'localhost',
  port: 8080,
  path: '/hawtio/jolokia',
} as const

export type ConnectionTestResult = {
  status: ConnectStatus
  message: string
}

export type ConnectionCredentials = {
  username: string
  password: string
}

export type LoginResult =
  | { type: 'success' }
  | { type: 'failure' }
  | { type: 'throttled'; retryAfter: number }
  | { type: 'session-expired' }

/**
 * Remote connection status. "not-reachable-securely" is for connections that can't be used in insecure contexts.
 */
export type ConnectStatus = 'not-reachable' | 'reachable' | 'not-reachable-securely'

const STORAGE_KEY_CONNECTIONS = 'connect.connections'

const SESSION_KEY_SALT = 'connect.salt'
const SESSION_KEY_CREDENTIALS = 'connect.credentials' // Encrypted

export const SESSION_KEY_CURRENT_CONNECTION = 'connect.currentConnection'
export const PARAM_KEY_CONNECTION = 'con'
export const PARAM_KEY_REDIRECT = 'redirect'

const PATH_LOGIN = '/connect/login'
const PATH_PRESET_CONNECTIONS = 'preset-connections'

export interface IConnectService {
  getCurrentConnectionId(): string | null
  getCurrentConnectionName(): string | null
  getCurrentConnection(): Promise<Connection | null>
  getCurrentCredentials(): Promise<ConnectionCredentials | null>
  loadConnections(): Connections
  saveConnections(connections: Connections): void
  getConnection(id: string): Connection | null
  connectionToUrl(connection: Connection): string
  checkReachable(connection: Connection): Promise<ConnectStatus>
  testConnection(connection: Connection): Promise<ConnectionTestResult>
  connect(connection: Connection): void
  login(username: string, password: string): Promise<LoginResult>
  redirect(): void
  createJolokia(connection: Connection, checkCredentials?: boolean): IJolokiaSimple
  getJolokiaUrl(connection: Connection): string
  getJolokiaUrlFromId(name: string): string | null
  getLoginPath(): string
  export(connections: Connections): void
}

class ConnectService implements IConnectService {
  private readonly currentConnectionId: string | null

  constructor() {
    this.currentConnectionId = this.initCurrentConnection()
  }

  private initCurrentConnection(): string | null {
    // Check remote connection from URL query param
    const url = new URL(window.location.href)
    const searchParams = url.searchParams
    log.debug('Checking search params:', searchParams.toString())
    let conn = searchParams.get(PARAM_KEY_CONNECTION)
    if (conn) {
      searchParams.delete(PARAM_KEY_CONNECTION, conn)
      sessionStorage.setItem(SESSION_KEY_CURRENT_CONNECTION, JSON.stringify(conn))
      // clear "con" parameter - will be available in session storage only
      url.search = searchParams.toString()
      window.history.replaceState(null, '', url)

      return conn
    }

    // Case when user may refresh the page after "con" parameter has already been cleared
    // Check remote connection from session storage
    conn = sessionStorage.getItem(SESSION_KEY_CURRENT_CONNECTION)
    if (conn) {
      return JSON.parse(conn)
    }

    // Processing preset connections should come at last to prevent processing
    // them multiple times, because it may open new tab(s)/session(s) with `?con=`
    // to auto-connect to them later.
    this.loadPresetConnections()

    return null
  }

  /**
   * See: https://github.com/hawtio/hawtio/issues/3731
   */
  private async loadPresetConnections(): Promise<void> {
    try {
      const res = await fetch(PATH_PRESET_CONNECTIONS)
      if (!res.ok) {
        log.debug('Failed to load preset connections:', res.status, res.statusText)
        return
      }

      const preset: Partial<Connection>[] = await res.json()
      log.debug('Preset connections:', preset)
      const connections = this.loadConnections()
      const toOpen: Connection[] = []
      preset.forEach(({ name, scheme, host, port, path }) => {
        // name must be always defined
        if (!name) {
          return
        }
        let conn = Object.values(connections).find(c => c.name === name)
        if (scheme && host && port && path) {
          if (port < 0) {
            // default ports
            port = scheme === 'https' ? 443 : 80
          }
          if (!conn) {
            conn = { id: '', name, scheme, host, port, path }
            this.generateId(conn, connections)
            connections[conn.id] = conn
          } else {
            conn.scheme = scheme
            conn.host = host
            conn.port = port
            conn.path = path
          }
          toOpen.push(conn)
        } else if (conn) {
          // Open connection only when it exists
          toOpen.push(conn)
        }
      })
      this.saveConnections(connections)

      // Open connections in new tabs
      toOpen.forEach(c => this.connect(c))
    } catch (err) {
      // Silently ignore errors
      log.debug('Error loading preset connections:', err)
    }
  }

  getCurrentConnectionId(): string | null {
    return this.currentConnectionId
  }

  getCurrentConnectionName(): string | null {
    const id = this.currentConnectionId
    if (!id) {
      return null
    }
    const connection = this.getConnection(id)
    return connection?.name ?? null
  }

  async getCurrentConnection(): Promise<Connection | null> {
    const id = this.currentConnectionId
    const conn = id ? this.getConnection(id) : null
    if (!conn) {
      return null
    }

    // Apply credentials if it exists
    const credentials = await this.getCurrentCredentials()
    if (!credentials) {
      return conn
    }
    conn.username = credentials.username
    conn.password = credentials.password
    this.clearCredentialsOnLogout()

    return conn
  }

  private clearCredentialsOnLogout() {
    eventService.onLogout(() => sessionStorage.clear())
  }

  async getCurrentCredentials(): Promise<ConnectionCredentials | null> {
    if (!window.isSecureContext) {
      return null
    }
    const saltItem = sessionStorage.getItem(SESSION_KEY_SALT)
    if (!saltItem) {
      return null
    }
    const salt = toByteArray(saltItem)

    const credItem = sessionStorage.getItem(SESSION_KEY_CREDENTIALS)
    if (!credItem) {
      return null
    }
    const key = await generateKey(salt)
    return JSON.parse(await decrypt(key, credItem))
  }

  private async setCurrentCredentials(credentials: ConnectionCredentials) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16))
    sessionStorage.setItem(SESSION_KEY_SALT, toBase64(salt))
    const key = await generateKey(salt)
    const encrypted = await encrypt(key, JSON.stringify(credentials))
    sessionStorage.setItem(SESSION_KEY_CREDENTIALS, encrypted)
  }

  loadConnections(): Connections {
    const item = localStorage.getItem(STORAGE_KEY_CONNECTIONS)
    if (!item) {
      return {}
    }
    const conns: Connections = JSON.parse(item)

    Object.values(conns).forEach(conn => {
      // Make sure scheme is not compromised for each connection
      if (conn.scheme !== 'http' && conn.scheme !== 'https') {
        log.warn('Invalid scheme for connection:', conn)
        // Force resetting to 'http' for any invalid scheme
        conn.scheme = 'http'
      }
      // Make sure there's an ID for each connection
      if (!conn.id) {
        this.generateId(conn, conns)
      }
    })

    return conns
  }

  saveConnections(connections: Connections) {
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections))
  }

  generateId(connection: Connection, connections: Connections) {
    for (;;) {
      if (!connection.id) {
        // first, generate only for new connection and keep for imported connection
        connection.id = '' + Math.floor(Math.random() * 1000000)
        connection.id = 'c' + connection.id.padStart(6, '0') + '-' + Date.now()
      }
      let exists = false
      for (const c in connections) {
        if (c === connection.id) {
          exists = true
        }
        if (exists) {
          // we've imported a connection and there's already a connection with given ID
          // so we have to re-generate id for the imported connection
          connection.id = ''
        }
      }
      if (!exists) {
        break
      }
    }
  }

  getConnection(id: string): Connection | null {
    const connections = this.loadConnections()
    return connections[id] ?? null
  }

  connectionToUrl(connection: Connection): string {
    let url = `${connection.scheme}://${connection.host}:${connection.port}`
    if (!connection.path.startsWith('/')) {
      url += '/'
    }
    url += connection.path
    return url
  }

  async checkReachable(connection: Connection): Promise<ConnectStatus> {
    try {
      const result = await this.testConnection(connection)
      return result.status
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return 'not-reachable'
    }
  }

  testConnection(connection: Connection): Promise<ConnectionTestResult> {
    log.debug('Testing connection:', toString(connection))
    // test the connection without credentials, so 401 or 403 are treated as "reachable", but actual
    // connection will require authentication
    // When server returns "WWW-Authenticate: Basic xxx", we can't prevent showing native popup dialog with xhr,
    // but we can do that with fetch + "credentials:'omit'"
    // However we have to include the credentials, because it's not only about "Authorization" header (which may
    // be created using data stored in browser's password manager) - it's also about cookies. When testing
    // reachability of remote Jolokia agent, we have to send JSESSIONID, because /proxy/* is protected. However
    // we prevent native browser dialog because Hawtio proxy translates "WWW-Authenticate: Basic xxx", so it
    // doesn't include "Basic" scheme. This is enough for the browser to skip the dialog. Even with xhr.
    return new Promise<ConnectionTestResult>((resolve, reject) => {
      try {
        const xsrfToken = getCookie('XSRF-TOKEN')
        const headers: { [header: string]: string } = {}
        if (xsrfToken) {
          headers['X-XSRF-TOKEN'] = xsrfToken
        }
        fetch(this.getJolokiaUrl(connection), {
          method: 'post',
          // with application/json, I'm getting "CanceledError: Request stream has been aborted" when running
          // via hawtioMiddleware...
          headers: { ...headers, 'Content-Type': 'text/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ type: 'version' }),
        })
          .then(response => {
            if (response.ok) {
              // 200-299
              resolve({ status: 'reachable', message: 'Connection successful' })
            } else if (response.status === 401) {
              resolve({
                status: window.isSecureContext ? 'reachable' : 'not-reachable-securely',
                message: window.isSecureContext
                  ? 'Connection successful (auth needed)'
                  : 'Connection failed (insecure context)',
              })
            } else if (response.status === 403) {
              this.forbiddenReasonMatches(response, 'HOST_NOT_ALLOWED').then(matches => {
                if (matches) {
                  resolve({ status: 'not-reachable', message: 'Host not allowlisted' })
                } else {
                  resolve({
                    status: window.isSecureContext ? 'reachable' : 'not-reachable-securely',
                    message: window.isSecureContext
                      ? 'Connection successful (auth failed)'
                      : 'Connection failed (insecure context)',
                  })
                }
              })
            } else {
              resolve({ status: 'not-reachable', message: 'Connection failed' })
            }
          })
          .catch(error => {
            log.error('Exception', error)
            reject(error)
          })
      } catch (error) {
        log.error(error)
        reject(error)
      }
    })
  }

  private async forbiddenReasonMatches(response: Response, reason: string): Promise<boolean> {
    // Preserve compatibility with versions of Hawtio 2.x that return JSON on 403 responses
    return response
      .text()
      .then(txt => {
        const json = JSON.parse(txt)
        // exception will propagate to .catch()
        return json['reason'] === reason
      })
      .catch(_ => {
        // Otherwise expect a response header containing a forbidden reason
        return response.headers.get('Hawtio-Forbidden-Reason') === reason
      })
  }

  connect(connection: Connection) {
    log.debug('Connecting with options:', toString(connection))
    const basepath = hawtio.getBasePath() ?? ''
    const url = `${basepath}/?${PARAM_KEY_CONNECTION}=${connection.id}`
    log.debug('Opening URL:', url)
    // let's open the same connection in the same tab (2nd parameter)
    window.open(url, connection.id)
  }

  /**
   * Log in to the current connection.
   */
  async login(username: string, password: string): Promise<LoginResult> {
    const connection = await this.getCurrentConnection()
    if (!connection) {
      return { type: 'failure' }
    }

    // Check credentials
    const result = await new Promise<LoginResult>(resolve => {
      // this special header is used to pass credentials to remote Jolokia agent when
      // Authorization header is already "taken" by OIDC/Keycloak authenticator
      const headers: Record<string, string> = {
        'X-Jolokia-Authorization': basicAuthHeaderValue(username, password),
      }
      const token = getCookie('XSRF-TOKEN')
      if (token) {
        // For CSRF protection with Spring Security
        headers['X-XSRF-TOKEN'] = token
      }
      this.createJolokia(connection, true).request(
        { type: 'version' },
        {
          success: () => resolve({ type: 'success' }),
          // this handles Jolokia error (HTTP status = 200, Jolokia status != 200) - unlikely for "version" request
          error: () => resolve({ type: 'failure' }),
          // this handles HTTP status != 200 or other communication error (like connection refused)
          fetchError: (response: Response | null, error: DOMException | TypeError | string | null) => {
            if (response) {
              log.debug('Login error:', response.status, response.statusText)
              if (response.status === 429) {
                // Login throttled
                const retryAfter = parseInt(response.headers.get('Retry-After') ?? '0')
                resolve({ type: 'throttled', retryAfter })
                return
              }
              if (response.status === 403 && 'SESSION_EXPIRED' === response.headers.get('Hawtio-Forbidden-Reason')) {
                resolve({ type: 'session-expired' })
                return
              }
            } else {
              // more serious problem - no fetch() response at all, just an exception
              log.debug('Login error:', error)
            }
            resolve({ type: 'failure' })
          },
          headers,
        },
      )
    })
    if (result.type !== 'success') {
      return result
    }

    // Persist credentials to session storage
    if (window.isSecureContext) {
      await this.setCurrentCredentials({ username, password })
    }
    this.clearCredentialsOnLogout()

    return result
  }

  /**
   * Redirect to the URL specified in the query parameter {@link PARAM_KEY_REDIRECT}.
   */
  redirect() {
    const url = new URL(window.location.href)
    let redirect = url.searchParams.get(PARAM_KEY_REDIRECT) ?? '/'
    let safeRedirect: boolean = false

    try {
      const { hostname, port, protocol, searchParams } = new URL(redirect)
      let connectionKey = searchParams.get(PARAM_KEY_CONNECTION) ?? ''
      if (connectionKey === '') {
        connectionKey = sessionStorage.getItem(SESSION_KEY_CURRENT_CONNECTION) ?? ''
      }
      safeRedirect =
        hostname === url.hostname &&
        port === url.port &&
        ['http:', 'https:'].includes(protocol) &&
        connectionKey !== '' &&
        connectionKey === this.currentConnectionId
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      log.error('Invalid URL')
      eventService.notify({
        type: 'danger',
        message: 'Redirect parameter was modified',
      })
    }

    if (!safeRedirect) {
      redirect = hawtio.getBasePath() ?? '/'
    }

    log.debug('Redirect to:', redirect)
    window.location.href = encodeURI(redirect)
  }

  /**
   * Create a Jolokia instance with the given connection.
   */
  createJolokia(connection: Connection, checkCredentials = false): IJolokiaSimple {
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

    const url = joinPaths(
      hawtio.getBasePath() ?? '',
      '/proxy',
      connection.scheme ?? 'http',
      connection.host ?? 'localhost',
      String(connection.port ?? 80),
      connection.path,
    )
    log.debug('Using URL:', url)
    return url
  }

  /**
   * Get the Jolokia URL for the given connection ID.
   */
  getJolokiaUrlFromId(id: string): string | null {
    const connection = this.getConnection(id)
    return connection ? this.getJolokiaUrl(connection) : null
  }

  getLoginPath(): string {
    const basePath = hawtio.getBasePath()
    return `${basePath}${PATH_LOGIN}`
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
