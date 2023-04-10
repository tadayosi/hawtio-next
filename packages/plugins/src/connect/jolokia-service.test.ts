import { DEFAULT_MAX_COLLECTION_SIZE, DEFAULT_MAX_DEPTH, jolokiaService } from './jolokia-service'

describe('JolokiaService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('load and save Jolokia options', () => {
    let options = jolokiaService.loadJolokiaStoredOptions()
    expect(options.maxDepth).toEqual(DEFAULT_MAX_DEPTH)
    expect(options.maxCollectionSize).toEqual(DEFAULT_MAX_COLLECTION_SIZE)

    jolokiaService.saveJolokiaStoredOptions({ maxDepth: 3, maxCollectionSize: 10000 })
    options = jolokiaService.loadJolokiaStoredOptions()
    expect(options.maxDepth).toEqual(3)
    expect(options.maxCollectionSize).toEqual(10000)
  })
})
