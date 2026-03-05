import { hawtio, type HawtioPlugin } from '@hawtiosrc/core'
import { helpRegistry } from '@hawtiosrc/help/registry'
import { pluginId, pluginPath } from './globals'
import help from './help.md'
import { flightRecorderService } from './flight-recorder-service'
import { jolokiaService } from '../shared'

const order = 19

export const jvmDiagnostics: HawtioPlugin = () => {
  hawtio.addDeferredPlugin(pluginId, async () => {
    return import('./ui').then(m => {
      return {
        id: pluginId,
        title: 'JVM Diagnostics',
        path: pluginPath,
        order,
        component: m.JvmDiagnostics,
        isActive: async () => {
          const jolokiaUrl = await jolokiaService.getFullJolokiaUrl()

          return (
            (await flightRecorderService.hasFlightRecorderMBean()) &&
            ['localhost', '127.0.0.1', '::1', '192.168.', '10.0'].filter(localUrl => jolokiaUrl.includes(localUrl))
              .length != 0
          )
        },
      }
    })
  })

  helpRegistry.add(pluginId, 'JVM Diagnostics', help, order)
}
