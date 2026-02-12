export const PARAM_KEY_NODE = 'nid'

/**
 * Encode a node path to a URL-safe string
 */
export function encodeNodePath(path: string[]): string {
  return path.map(segment => encodeURIComponent(segment)).join('/')
}

/**
 * Decode a URL-safe string back to a node path
 */
export function decodeNodePath(encoded: string): string[] {
  return encoded.split('/').map(segment => decodeURIComponent(segment))
}

/**
 * Build URL query string with nid parameter, preserving other existing params
 * @param path - The node path to encode
 * @param basePath - Optional base path to prepend (e.g., pluginPath)
 */
export function buildNidUrl(path: string[], basePath?: string): string {
  const searchParams = new URLSearchParams(window.location.search)
  searchParams.set(PARAM_KEY_NODE, encodeNodePath(path))
  const query = `?${searchParams.toString()}`
  return basePath ? `${basePath}${query}` : query
}
