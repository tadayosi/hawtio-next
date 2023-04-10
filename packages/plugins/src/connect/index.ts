import { hawtio, HawtioPlugin } from '@hawtio/react/core'
import { helpRegistry } from '@hawtio/react/help/registry'
import { preferencesRegistry } from '@hawtio/react/preferences/registry'
import { Connect } from './Connect'
import { ConnectPreferences } from './ConnectPreferences'
import help from './help.md'
import { isActive } from './init'

export const connect: HawtioPlugin = () => {
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
