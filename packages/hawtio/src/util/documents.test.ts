import { documentBase } from './documents'

describe('documents', () => {
  test('documentBase with empty head', () => {
    document.head.innerHTML = ''
    expect(documentBase()).toBeUndefined()
  })

  test('documentBase with base href in head', () => {
    document.head.innerHTML = `
      <base href='/test'/>
    `
    expect(documentBase()).toEqual('/test')
  })
})
