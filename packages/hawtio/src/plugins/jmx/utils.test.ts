import { decodeNodePath, encodeNodePath, PARAM_KEY_NODE } from './utils'

describe('JMX utils', () => {
  test('constants', () => {
    expect(PARAM_KEY_NODE).toBe('nid')
  })

  test('encodeNodePath', () => {
    expect(encodeNodePath(['java.lang', 'Memory'])).toBe('java.lang/Memory')
    expect(encodeNodePath(['java.lang', 'Name=Heap/Memory'])).toBe('java.lang/Name%3DHeap%2FMemory')
    expect(encodeNodePath(['prop with spaces', 'value'])).toBe('prop%20with%20spaces/value')
    expect(encodeNodePath([])).toBe('')
  })

  test('decodeNodePath', () => {
    expect(decodeNodePath('java.lang/Memory')).toEqual(['java.lang', 'Memory'])
    expect(decodeNodePath('java.lang/Name%3DHeap%2FMemory')).toEqual(['java.lang', 'Name=Heap/Memory'])
    expect(decodeNodePath('prop%20with%20spaces/value')).toEqual(['prop with spaces', 'value'])
  })

  test('round trip', () => {
    const paths = [
      ['java.lang', 'Memory'],
      ['my-domain', 'type=Foo,name=Bar'],
      ['complex', 'a/b', 'c=d', 'spaces here'],
    ]

    paths.forEach(path => {
      expect(decodeNodePath(encodeNodePath(path))).toEqual(path)
    })
  })
})
