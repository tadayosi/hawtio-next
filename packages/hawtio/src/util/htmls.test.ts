import { escapeHtmlId, escapeTags } from './htmls'

describe('htmls', () => {
  test('escapeTags', () => {
    expect(escapeTags('domain-name')).toEqual('domain-name')
    expect(escapeTags('<domain-name>')).toEqual('&lt;domain-name&gt;')
    expect(escapeTags('<domain-name><host-name>')).toEqual('&lt;domain-name&gt;&lt;host-name&gt;')
    expect(escapeTags('"SampleContext"')).toEqual('"SampleContext"')
  })

  test('escapeHtmlId', () => {
    expect(escapeHtmlId('java.lang')).toEqual('java.lang')
    expect(escapeHtmlId('Camel Contexts')).toEqual('CamelContexts')
  })
})
