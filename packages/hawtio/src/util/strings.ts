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
    .map(_ => '*')
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

export function stringSorter(a: string, b: string, sortDesc?: boolean): number {
  let res = a.localeCompare(b)
  if (sortDesc) {
    res *= -1
  }
  return res
}

export function parseBoolean(value: string): boolean {
  if (!value) return false

  return /^true$/i.test(value) || parseInt(value) === 1
}

/**
 * Will format a property to a standard human readable string with its spaces.
 * It will respect MBean and leave it together
 * @param str The property to transform
 * @returns The property with its proper spaces
 */
export function humanizeLabels(str: string): string {
  return str
    .split('-')
    .filter(str => !isBlank(str))
    .map(str => str.replace(/^./, str => str.toUpperCase()))
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
    .replace('M Bean', 'MBean')
    .replace('Mbean', 'MBean')
    .replace(/^./, str => str.toUpperCase())
    .replace(/ +/, ' ')
    .trim()
}

/**
 * Matches the given string value with the pattern.
 * A pattern can be the exact matching string or an expression that includes '*'
 * as wildcard.
 */
export function matchWithWildcard(value: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return value === pattern
  }

  // The '*' is used as the wildcard to remove it, escape the rest and rejoin with
  // the correct regex syntax.
  const rule = pattern
    .split('*')
    // Escape any regex special characters.
    // RegExp.escape() should work in browser since 2025. Part of ECMAScript 2027
    .map(s => s.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1'))
    .join('.*')
  const regexp = new RegExp(`^${rule}$`, 'i')
  return value.match(regexp) !== null
}
