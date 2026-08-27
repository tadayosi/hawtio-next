import { Logger } from '@hawtiosrc/core/logging'

export const jmxDomain = 'org.apache.camel'
export const pluginPath = '/camel'
export const pluginName = 'hawtio-camel'
export const log = Logger.get(pluginName)

export const PARAM_KEY_NODE_ID = 'nid'

export const camelContexts = 'Camel Contexts'

export const domainNodeType = 'Camel Domain'
export const contextsType = 'contexts'
export const routesType = 'routes'
export const routeGroupsType = 'routeGroups'
export const endpointsType = 'endpoints'
export const componentsType = 'components'
export const dataformatsType = 'dataformats'

export const contextNodeType = 'context'
export const routeNodeType = 'routeNode'
export const routeXmlNodeType = 'routeXmlNode'
export const endpointNodeType = 'endpointNode'
export const componentNodeType = 'componentNode'
export const defaultRouteGroupsType = 'default'
export const mbeansType = 'MBeans'

/*
 * The property name used to store the 'localName' property
 * of the xml nodes, eg. <to id="red5" ... /> where localName is 'to'
 * This is useful to retain since the camelSchema is keyed
 * on these values.
 */
export const xmlNodeLocalName = 'xmlNodeLocalName'
