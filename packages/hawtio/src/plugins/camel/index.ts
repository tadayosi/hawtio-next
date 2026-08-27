import { hawtio, type HawtioPlugin } from '@hawtiosrc/core'
import { helpRegistry } from '@hawtiosrc/help/registry'
import { treeProcessorRegistry, workspace } from '@hawtiosrc/plugins/shared'
import { preferencesRegistry } from '@hawtiosrc/preferences/registry'
import { getCamelVersions } from './camel-service'
import { PARAM_KEY_NODE_ID, jmxDomain, log, pluginPath } from './globals'
import help from './help.md'
import { camelTreeProcessor } from './tree-processor'

const order = 12

export const camel: HawtioPlugin = () => {
  hawtio.addDeferredPlugin('camel', async () => {
    return import('./ui').then(m => {
      preferencesRegistry.add('camel', 'Camel', m.CamelPreferences, order)
      return {
        id: 'camel',
        title: 'Camel',
        path: pluginPath,
        order,
        component: m.Camel,
        knownQueryParams: [PARAM_KEY_NODE_ID],
        isActive: async () => {
          return workspace.treeContainsDomainAndProperties(jmxDomain)
        },
      }
    })
  })

  treeProcessorRegistry.add('camel', camelTreeProcessor)
  helpRegistry.add('camel', 'Camel', help, order)

  getCamelVersions().then(versions => {
    log.info('Using Camel versions:', versions)
  })
}
