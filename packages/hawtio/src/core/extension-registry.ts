import type React from 'react'

const DEFAULT_ORDER = 100

export interface ExtensionEntry<TProps = Record<string, unknown>> {
  component: React.ComponentType<TProps>
  /** ID of the plugin registering this extension. Used by `removeByPlugin` for bulk cleanup on plugin unload. */
  pluginId: string
  /** Display order within the same slot (ascending). Defaults to 100. */
  order?: number
}

/**
 * Internal registry of UI extensions keyed by slot ID.
 *
 * External code should use `hawtio.addExtension()` instead of accessing this directly.
 */
class ExtensionRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private slots = new Map<string, ExtensionEntry<any>[]>()

  add<TProps = Record<string, unknown>>(slotId: string, entry: ExtensionEntry<TProps>): void {
    const entries = this.slots.get(slotId) ?? []
    if (entries.some(e => e.component === entry.component)) {
      throw new Error(`Extension component already registered in slot '${slotId}'`)
    }
    this.slots.set(slotId, [...entries, entry])
  }

  /**
   * Returns the extensions registered for the slot, sorted by `order` (ascending).
   * Extensions with the same `order` keep their registration order.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(slotId: string): ExtensionEntry<any>[] {
    const entries = this.slots.get(slotId) ?? []
    return [...entries].sort((a, b) => (a.order ?? DEFAULT_ORDER) - (b.order ?? DEFAULT_ORDER))
  }

  removeByPlugin(pluginId: string): void {
    for (const [slotId, entries] of [...this.slots]) {
      const remaining = entries.filter(e => e.pluginId !== pluginId)
      if (remaining.length === 0) {
        this.slots.delete(slotId)
      } else {
        this.slots.set(slotId, remaining)
      }
    }
  }

  reset(): void {
    this.slots.clear()
  }
}

export const extensionRegistry = new ExtensionRegistry()
