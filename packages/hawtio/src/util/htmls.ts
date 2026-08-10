/**
 * Escapes only tags ('<' and '>') as opposed to typical URL encodings.
 *
 * @param text string to be escaped
 */
export function escapeTags(text: string): string {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/**
 * Escapes characters that cannot be used as HTML `id` attribute.
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id
 *
 * Space characters are escaped to ''.
 *
 * @param text string to be escaped
 */
export function escapeHtmlId(text: string): string {
  if (!text) {
    return ''
  }
  if (text === encodeURIComponent(text)) {
    return text
  }
  let encoded = window.btoa(text)
  encoded = encoded.replace(/=+$/, '')
  encoded = encoded.replaceAll('+', '-')
  encoded = encoded.replaceAll('/', '_')
  return `b:${encoded}`
  // return text.replace(/\s/g, '')
}
