import { hawtio, type HawtioPlugin } from '@hawtio/react'

const pluginId = 'example1b'

// This is the recommended approach to register Hawtio plugins which use PatternFly components.
// Instead of importing the component using `import` statement, the component module is imported
// with `import()` operator. This requires different approach and new hawtio.addDeferredPlugin() API
export const registerExample1Deferred: HawtioPlugin = () => {
  hawtio.addDeferredPlugin(pluginId, async () => {
    return import('./Example1').then(m => {
      // Example: injecting a UI extension into the JMX Attributes toolbar slot.
      // Any plugin can call hawtio.addExtension() inside its deferred loader to register
      // components into a slot declared by another plugin, without a direct import.
      hawtio.addExtension('jmx-attributes-toolbar', {
        component: m.Example1ExtensionButton,
        pluginId,
        order: 10,
      })

      return {
        id: pluginId,
        title: 'Example 1 (deferred)',
        path: '/example1b',
        component: m.Example1,
        isActive: async () => true,
      }
    })
  })
}
