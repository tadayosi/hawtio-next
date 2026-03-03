import { configManager, eventService, EVENT_PLUGINS_UPDATED, Hawtconfig, hawtio, Plugin } from '@hawtiosrc/core'
import { useEffect, useState } from 'react'
import { log } from './globals'

/**
 * Custom React hook for accessing information about Hawtio plugins.
 *
 * This hook holds:
 * * a state for an array of Plugin objects
 * * a state for a flag indicating that plugins are loaded
 *
 * This hook synchronizes with internal Hawtio services that manage plugins state and configuration.
 */
export function usePlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [pluginsLoaded, setPluginsLoaded] = useState(false)

  log.debug('usePlugins - Plugins:', hawtio.getPlugins())

  useEffect(() => {
    const loadPlugins = async () => {
      // active plugins are selected depending on "user logged in" flag to separate
      // plugins used by <HawtioPage> and <HawtioLogin>
      const activePlugins = await hawtio.resolvePlugins()
      // Filter plugins by hawtconfig.json
      const enabledPlugins = await configManager.filterEnabledPlugins(activePlugins)
      setPlugins(enabledPlugins)
      setPluginsLoaded(true)
    }
    loadPlugins()

    // Reload plugins when they are updated elsewhere
    eventService.onPluginsUpdated(loadPlugins)
    return () => eventService.removeListener(EVENT_PLUGINS_UPDATED, loadPlugins)
  }, [])

  return { plugins, pluginsLoaded }
}

/**
 * Custom React hook for using `hawtconfig.json`.
 *
 * This hook holds:
 * * a state for `Hawtconfig` object
 *
 * This hook synchronizes (once, cached in `configManager`) with `hawtconfig.json` resource.
 */
export function useHawtconfig() {
  const [hawtconfig, setHawtconfig] = useState<Hawtconfig>({})
  const [hawtconfigLoaded, setHawtconfigLoaded] = useState(false)

  useEffect(() => {
    const loadHawtconfig = async () => {
      setHawtconfig(await configManager.getHawtconfig())
      setHawtconfigLoaded(true)
    }
    loadHawtconfig()
  }, [])

  return { hawtconfig, hawtconfigLoaded }
}
