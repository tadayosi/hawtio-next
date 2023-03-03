import { Logger } from '@hawtiosrc/core'
import {
  IBulkOptions,
  IErrorResponse,
  IErrorResponseFn,
  IJmxOperationArgument,
  IListOptions,
  IListResponseFn,
  IOptions,
  IOptionsBase,
  IResponseFn,
  ISearchOptions,
  ISearchResponseFn,
  ISimpleOptions,
  ISimpleResponseFn,
  IVersionOptions,
  IVersionResponseFn,
} from 'jolokia.js'

const log = Logger.get('hawtio-util')

export function onSuccess(successFn: IResponseFn, options: IOptions = {}): IOptions {
  return onGenericSuccess(successFn, options)
}

export function onSimpleSuccess(successFn: ISimpleResponseFn, options: ISimpleOptions = {}): ISimpleOptions {
  return onGenericSuccess(successFn, options)
}

export function onSimpleSuccessAndError(
  successFn: ISimpleResponseFn,
  errorFn: IErrorResponseFn,
  options: ISimpleOptions = {},
): ISimpleOptions {
  return onGenericSuccessAndError(successFn, errorFn, options)
}

export function onSearchSuccess(successFn: ISearchResponseFn, options: ISearchOptions = {}): ISearchOptions {
  return onGenericSuccess(successFn, options)
}

export function onListSuccess(successFn: IListResponseFn, options: IListOptions = {}): IListOptions {
  return onGenericSuccess(successFn, options)
}

export function onVersionSuccess(successFn: IVersionResponseFn, options: IVersionOptions = {}): IVersionOptions {
  return onGenericSuccess(successFn, options)
}

export function onBulkSuccess(successFn: IResponseFn | IResponseFn[], options: IBulkOptions = {}): IBulkOptions {
  return onGenericSuccess(successFn, options)
}

export function onGenericSuccess<R, O extends IOptionsBase>(successFn: R, options?: O): O {
  return onGenericSuccessAndError(successFn, defaultErrorHandler(options), options)
}

export function onGenericSuccessAndError<R, O extends IOptionsBase>(
  successFn: R,
  errorFn: IErrorResponseFn,
  options?: O,
): O {
  const defaultOptions: IOptionsBase = {
    method: 'POST',
    mimeType: 'application/json',
    // the default (unsorted) order is important for Karaf runtime
    canonicalNaming: false,
    canonicalProperties: false,
  }
  return Object.assign({}, defaultOptions, options, {
    success: successFn,
    error: errorFn,
  })
}

/**
 * The default error handler which logs errors either using debug or log level logging
 * based on the silent setting.
 */
function defaultErrorHandler(options?: IOptionsBase): IErrorResponseFn {
  return (response: IErrorResponse) => {
    if (!response.error) {
      return
    }

    const req = response.request
    const operation = req?.type === 'exec' ? req.operation : 'unknown'
    // 'silent' is a custom option only defined in Hawtio
    const silent = options?.silent
    if (silent || isIgnorableException(response)) {
      log.debug('Operation', operation, 'failed due to:', response.error)
    } else {
      log.warn('Operation', operation, 'failed due to:', response.error)
    }
  }
}

/**
 * Checks if it's an error that can happen on timing issues such as being removed
 * or if we run against older containers.
 *
 * @param response the error response from a Jolokia request
 */
function isIgnorableException(response: IErrorResponse): boolean {
  const ignorables = [
    'InstanceNotFoundException',
    'AttributeNotFoundException',
    'IllegalArgumentException: No operation',
  ]
  const test = (e: string) => ignorables.some(i => e.indexOf(i) >= 0)
  return (response.stacktrace != null && test(response.stacktrace)) || (response.error != null && test(response.error))
}

/**
 * Escapes the mbean for Jolokia GET requests.
 *
 * @param mbean the MBean
 */
export function escapeMBean(mbean: string): string {
  return encodeURI(applyJolokiaEscapeRules(mbean))
}

/**
 * Escapes the MBean as a path for Jolokia POST "list" requests.
 * See: https://jolokia.org/reference/html/protocol.html#list
 *
 * @param mbean the MBean
 */
export function escapeMBeanPath(mbean: string): string {
  return applyJolokiaEscapeRules(mbean).replace(':', '/')
}

/**
 * Applies the Jolokia escaping rules to the MBean name.
 * See: http://www.jolokia.org/reference/html/protocol.html#escape-rules
 *
 * @param mbean the MBean
 */
function applyJolokiaEscapeRules(mbean: string): string {
  return mbean.replace(/!/g, '!!').replace(/\//g, '!/').replace(/"/g, '!"')
}

/**
 * Escapes only tags ('<' and '>') as opposed to typical URL encodings.
 *
 * @param text string to be escaped
 */
export function escapeTags(text: string): string {
  let escaped = text.replace('<', '&lt;')
  escaped = escaped.replace('>', '&gt;')
  return escaped
}

/**
 * Escapes dots ('.') to '-'.
 *
 * @param text string to be escaped
 */
export function escapeDots(text: string): string {
  return text.replace(/\./g, '-')
}

export function operationToString(operation: string, args: IJmxOperationArgument[]): string {
  const argsStr = args.map(arg => arg.type).join(',')
  return `${operation}(${argsStr})`
}
