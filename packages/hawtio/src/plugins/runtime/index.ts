import { hawtio, type HawtioPlugin } from '@hawtiosrc/core'
import { pluginId, pluginPath } from './globals'
import { workspace } from '@hawtiosrc/plugins'
import { helpRegistry } from '@hawtiosrc/help'
import help from './help.md'

const order = 16

export const runtime: HawtioPlugin = () => {
  hawtio.addDeferredPlugin(pluginId, async () => {
    return import('./ui').then(m => {
      return {
        id: pluginId,
        title: 'Runtime',
        path: pluginPath,
        order,
        component: m.Runtime,
        isActive: async () => workspace.hasMBeans(),
      }
    })
  })
  helpRegistry.add(pluginId, 'Runtime', help, order)
}
