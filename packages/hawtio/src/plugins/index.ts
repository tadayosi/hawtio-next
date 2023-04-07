import { camel } from './camel'
import { connect } from './connect'
import { jmx } from './jmx'
import { rbac } from './rbac'

export const registerPlugins = () => {
  connect()
  jmx()
  rbac()
  camel()
}

export * from './camel'
export * from './connect'
export * from './jmx'
export * from './rbac'
export { PluginNodeSelectionContext, usePluginNodeSelected } from './selectionNodeContext'
export * from './shared'
