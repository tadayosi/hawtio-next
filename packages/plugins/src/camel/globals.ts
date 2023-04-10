import { Logger } from '@hawtio/react/core'

export const jmxDomain = 'org.apache.camel'
export const pluginPath = '/camel'
export const pluginName = 'hawtio-camel'
export const log = Logger.get(pluginName)

export const camelContexts = 'Camel Contexts'

export const domainNodeType = 'Camel Domain'
export const contextsType = 'contexts'
export const routesType = 'routes'
export const endpointsType = 'endpoints'
export const componentsType = 'components'
export const dataformatsType = 'dataformats'

export const contextNodeType = 'context'
export const routeNodeType = 'routeNode'
export const routeXmlNodeType = 'routeXmlNode'
export const endpointNodeType = 'endpointNode'
export const componentNodeType = 'componentNode'
export const mbeansType = 'MBeans'
