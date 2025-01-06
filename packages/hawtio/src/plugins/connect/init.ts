import { userService } from '@hawtiosrc/auth/user-service'
import { connectService } from '@hawtiosrc/plugins/shared/connect-service'
import { PATH_PROXY_ENABLED, log } from './globals'

export async function isActive(): Promise<boolean> {
  const proxyEnabled = await isProxyEnabled()
  if (!proxyEnabled) {
    return false
  }

  // The connect login path is exceptionally allowlisted to provide login form for
  // remote Jolokia endpoints requiring authentication.
  const connId = await connectService.getCurrentConnectionId()
  return connId === null || isConnectLogin()
}

export async function isConnectionStatusActive(): Promise<boolean> {
  const proxyEnabled = await isProxyEnabled()
  if (!proxyEnabled) {
    return false
  }

  // for "main" hawtio page, where this plugin is fully active, we don't have to show the connection status
  // but for actually connected tab, we want the status in the header
  const connId = await connectService.getCurrentConnectionId()
  return connId !== null
}

async function isProxyEnabled(): Promise<boolean> {
  try {
    const res = await fetch(PATH_PROXY_ENABLED)
    if (!res.ok) {
      // Silently ignore and enable it when fetch failed
      log.debug('Failed to fetch', PATH_PROXY_ENABLED, ':', res.status, res.statusText)
      return true
    }

    const data = await res.text()
    // Disable proxy only when explicitly disabled
    const enabled = data.trim() !== 'false'
    log.debug('Proxy enabled:', enabled)
    return enabled
  } catch (err) {
    // Silently ignore and enable it when the path is not available
    log.debug('Failed to fetch', PATH_PROXY_ENABLED, ':', err)
    return true
  }
}

function isConnectLogin(): boolean {
  const url = new URL(window.location.href)
  return url.pathname === connectService.getLoginPath()
}

/**
 * Register user hooks to userService if it's connecting to an authenticated
 * remote Jolokia endpoint with credentials in session storage, so that the user
 * can reflect the remote credentials.
 */
export function registerUserHooks() {
  const credPromise = connectService.getCurrentCredentials()

  // no fetchUserHook - remote Jolokia credentials are not Hawtio credentials

  userService.addLogoutHook('connect', async () => {
    const credentials = await credPromise
    if (!credentials) {
      return false
    }
    // Logout from remote connection should close the window
    window.close()
    return true
  })
}
