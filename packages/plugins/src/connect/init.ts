import { connectService } from './connect-service'
import { log, PATH_PROXY_ENABLED } from './globals'

export async function isActive(): Promise<boolean> {
  const proxyEnabled = await isProxyEnabled()
  if (!proxyEnabled) {
    return false
  }

  return connectService.getCurrentConnectionName() === null
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
