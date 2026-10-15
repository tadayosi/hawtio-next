import { extensionRegistry } from '@hawtiosrc/core/extension-registry'
import { preferencesService } from '@hawtiosrc/preferences/preferences-service'

/**
 * Renders all UI extensions registered for the given slot ID.
 *
 * Place this component at any point in a view to allow external plugins to inject UI
 * without requiring a direct import:
 *
 * ```tsx
 * // Host side (e.g. JMX Attributes view)
 * <HawtioExtensionSlot id='jmx-attributes-toolbar' props={{ node }} />
 *
 * // Extension side (e.g. AI plugin)
 * hawtio.addExtension('jmx-attributes-toolbar', { component: AiButton, pluginId: 'ai-plugin' })
 * ```
 *
 * Returns `null` when extensions are globally disabled in Preferences, or when no
 * extensions are registered for the slot.
 *
 * @param id   Slot identifier following the `<plugin>-<view>-<area>` naming convention.
 * @param props Optional props forwarded to every registered extension component.
 */
export function HawtioExtensionSlot<TProps extends Record<string, unknown>>({
  id,
  props,
}: {
  id: string
  props?: TProps
}) {
  if (!preferencesService.isExtensionsEnabled()) {
    return null
  }

  const entries = extensionRegistry.get(id)
  if (entries.length === 0) {
    return null
  }

  return (
    <>
      {entries.map(({ component: C }, i) => (
        <C key={i} {...(props as Record<string, unknown>)} />
      ))}
    </>
  )
}
