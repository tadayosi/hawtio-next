import { Logger } from '@hawtio/react/core'

export const pluginName = 'hawtio-shared'
export const log = Logger.get(pluginName)

export const HAWTIO_REGISTRY_MBEAN = 'hawtio:type=Registry'
export const HAWTIO_TREE_WATCHER_MBEAN = 'hawtio:type=TreeWatcher'
