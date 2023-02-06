import $ from 'jquery'

export function documentBase(): string | undefined {
  const base = $('head').find('base')
  if (base && base.length > 0) {
    return base.attr('href')
  }
  return undefined
}
