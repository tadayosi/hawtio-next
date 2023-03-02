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

export { jolokiaService } from './connect'
