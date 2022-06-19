import actionCreatorFactory from 'typescript-fsa'
import { reducerWithInitialState } from 'typescript-fsa-reducers'
import Plugins, { Plugin } from './state'

const actionCreator = actionCreatorFactory('hawtio')

export const actions = {
  registerPlugin: actionCreator<Plugin>('REGISTER_PLUGIN')
}

function registerPlugin(plugins: Plugins, plugin: Plugin): Plugins {
  return plugins.add(plugin)
}

const pageReducer = reducerWithInitialState(new Plugins())
  .case(actions.registerPlugin, registerPlugin)

export default pageReducer
