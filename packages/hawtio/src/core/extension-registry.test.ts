import { extensionRegistry } from './extension-registry'

const A = () => null
const B = () => null
const C = () => null

describe('extensionRegistry', () => {
  beforeEach(() => {
    extensionRegistry.reset()
  })

  test('returns empty array for unknown slot', () => {
    expect(extensionRegistry.get('unknown')).toEqual([])
  })

  test('add and get extensions', () => {
    extensionRegistry.add('slot', { component: A, pluginId: 'p1' })

    const entries = extensionRegistry.get('slot')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.component).toBe(A)
    expect(entries[0]?.pluginId).toBe('p1')
  })

  test('duplicate component in the same slot is not allowed', () => {
    extensionRegistry.add('slot', { component: A, pluginId: 'p1' })
    expect(() => extensionRegistry.add('slot', { component: A, pluginId: 'p2' })).toThrow(/already registered/)

    // same component in a different slot is fine
    extensionRegistry.add('other', { component: A, pluginId: 'p1' })
    expect(extensionRegistry.get('other')).toHaveLength(1)
  })

  test('returns extensions sorted by order, default order is 100', () => {
    extensionRegistry.add('slot', { component: A, pluginId: 'p1', order: 3 })
    extensionRegistry.add('slot', { component: B, pluginId: 'p1' }) // default order (100)
    extensionRegistry.add('slot', { component: C, pluginId: 'p1', order: 1 })

    expect(extensionRegistry.get('slot').map(e => e.component)).toEqual([C, A, B])
  })

  test('keeps registration order for the same order', () => {
    extensionRegistry.add('slot', { component: B, pluginId: 'p1' })
    extensionRegistry.add('slot', { component: A, pluginId: 'p1' })
    extensionRegistry.add('slot', { component: C, pluginId: 'p1' })

    expect(extensionRegistry.get('slot').map(e => e.component)).toEqual([B, A, C])
  })

  test('removeByPlugin removes extensions across all slots', () => {
    extensionRegistry.add('slot1', { component: A, pluginId: 'p1' })
    extensionRegistry.add('slot1', { component: B, pluginId: 'p2' })
    extensionRegistry.add('slot2', { component: C, pluginId: 'p1' })

    extensionRegistry.removeByPlugin('p1')

    expect(extensionRegistry.get('slot1').map(e => e.component)).toEqual([B])
    expect(extensionRegistry.get('slot2')).toEqual([])
  })

  test('reset clears all slots', () => {
    extensionRegistry.add('slot', { component: A, pluginId: 'p1' })
    extensionRegistry.reset()
    expect(extensionRegistry.get('slot')).toEqual([])
  })
})
