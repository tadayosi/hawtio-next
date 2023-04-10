import { hawtio, HawtioPlugin } from '@hawtio/react/core'
import { helpRegistry } from '@hawtio/react/help/registry'
import { treeProcessorRegistry, workspace } from '__root__/shared'
import { jmxDomain, pluginPath } from './globals'
import { camelTreeProcessor } from './tree-processor'
import { preferencesRegistry } from '@hawtio/react/preferences/registry'
import { Camel } from './Camel'
import { CamelPreferences } from './CamelPreferences'
import help from './help.md'

export const camel: HawtioPlugin = () => {
  hawtio.addPlugin({
    id: 'camel',
    title: 'Camel',
    path: pluginPath,
    component: Camel,
    isActive: async () => {
      return workspace.treeContainsDomainAndProperties(jmxDomain)
    },
  })

  treeProcessorRegistry.add('camel', camelTreeProcessor)
  helpRegistry.add('camel', 'Camel', help, 13)
  preferencesRegistry.add('camel', 'Camel', CamelPreferences, 13)
}
