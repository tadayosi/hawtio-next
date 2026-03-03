import { hawtio, type HawtioPlugin } from '@hawtiosrc/core'
import { helpRegistry } from '@hawtiosrc/help/registry'
import { workspace } from '@hawtiosrc/plugins/shared'
import { preferencesRegistry } from '@hawtiosrc/preferences'
import { pluginPath } from './globals'
import help from './help.md'

const order = 13

export const jmx: HawtioPlugin = () => {
  hawtio.addDeferredPlugin('jmx', async () => {
    return import('./ui').then(m => {
      preferencesRegistry.add('jmx', 'JMX', m.JmxPreferences, order)
      return {
        id: 'jmx',
        title: 'JMX',
        path: pluginPath,
        order,
        component: m.Jmx,
        isActive: async () => workspace.hasMBeans(),
      }
    })
  })
  helpRegistry.add('jmx', 'JMX', help, order)
}
