export function isString(value: unknown): value is string {
  if (value != null && typeof value.valueOf() === 'string') {
    return true
  }
  return false
}

/**
 * Return true if the string is either null or empty.
 */
export function isBlank(str?: string): boolean {
  if (str === undefined || str === null) {
    return true
  }
  if (typeof str !== 'string') {
    // not null but also not a string...
    return false
  }

  return str.trim().length === 0
}

/**
 * Simple toString that obscures any field called 'password'.
 */
export function toString(obj: unknown): string {
  if (!obj) {
    return '{}'
  }

  const strs = Object.entries(obj).map(([key, value]) => {
    let obscured = value
    if (key.toLowerCase() === 'password') {
      obscured = obfuscate(value)
    } else if (typeof value === 'object') {
      obscured = toString(obscured)
    }
    return `${key}: ${obscured}`
  })
  return `{ ${strs.join(', ')} }`
}

/**
 * Convert a string into a bunch of '*' of the same length.
 */
export function obfuscate(str: string): string {
  if (typeof str !== 'string') {
    return ''
  }
  return str
    .split('')
    .map(() => '*')
    .join('')
}

/**
 * Removes leading characters from a string.
 */
export function trimStart(text: string, chars: string): string {
  return text.replace(new RegExp(`^[${chars}]+`, 'g'), '')
}

/**
 * Removes trailing characters from a string.
 */
export function trimEnd(text: string, chars: string): string {
  return text.replace(new RegExp(`[${chars}]+$`, 'g'), '')
}

/**
 * Removes all quotes/apostrophes from the beginning and end of string.
 *
 * @param text
 * @returns {string}
 */
export function trimQuotes(text: string): string {
  if (text && text.length > 0) {
    // Make sure only enclosing quotes are removed
    const headTrimmed = trimStart(text, '\'"')
    if (headTrimmed.length < text.length) {
      return trimEnd(headTrimmed, '\'"')
    }
  }
  return text
}

export function stringSorter(a: string, b: string): number {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}
