import { treeProcessorRegistry } from './processor-registry'
import { MBeanTree } from './tree'

describe('treeProcessorRegistry', () => {
  beforeEach(() => {
    treeProcessorRegistry.reset()
  })

  test('add processors', async () => {
    expect(treeProcessorRegistry).not.toBeNull()
    expect(treeProcessorRegistry.getProcessors()).toEqual({})

    const tree = MBeanTree.createEmpty('test')

    // Processing without processors should not throw an error
    expect(() => treeProcessorRegistry.process(tree)).not.toThrowError()

    // Add a processor
    const testProcessor1 = jest.fn()
    treeProcessorRegistry.add('test1', testProcessor1)

    expect(treeProcessorRegistry.getProcessors()['test1']).toEqual(testProcessor1)
    await treeProcessorRegistry.process(tree)
    expect(testProcessor1.mock.calls).toHaveLength(1)

    // Add another processor
    const testProcessor2 = jest.fn()
    treeProcessorRegistry.add('test2', testProcessor2)

    expect(treeProcessorRegistry.getProcessors()['test2']).toEqual(testProcessor2)
    await treeProcessorRegistry.process(tree)
    expect(testProcessor1.mock.calls).toHaveLength(2)
    expect(testProcessor2.mock.calls).toHaveLength(1)
  })
})
