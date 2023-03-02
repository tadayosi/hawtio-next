import { hawtio } from '@hawtiosrc/core'
import { helpRegistry } from '@hawtiosrc/help/registry'
import { preferencesRegistry } from '@hawtiosrc/preferences/registry'
import { Connect } from './Connect'
import { ConnectPreferences } from './ConnectPreferences'
import help from './help.md'
import { isActive } from './init'

export const connect = () => {
  hawtio.addPlugin({
    id: 'connect',
    title: 'Connect',
    path: 'connect',
    component: Connect,
    isActive,
  })
  helpRegistry.add('connect', 'Connect', help, 11)
  preferencesRegistry.add('connect', 'Connect', ConnectPreferences, 11)
}

export { JolokiaListMethod, jolokiaService } from './jolokia-service'
