import { jolokiaService } from '../connect'
import { __testing__ } from './rbac-service'

jest.mock('@hawtiosrc/plugins/connect/jolokia-service')

describe('RBACService', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('there are no ACLMBeans', async () => {
    jolokiaService.search = jest.fn(async () => [])

    const rbacService = new __testing__.RBACService()
    await expect(rbacService.getACLMBean()).resolves.toBe('')
  })

  test('there is one ACLMBean', async () => {
    jolokiaService.search = jest.fn(async () => ['hawtio:type=security,area=jmx,name=HawtioTestJMXSecurity'])

    const rbacService = new __testing__.RBACService()
    await expect(rbacService.getACLMBean()).resolves.toBe('hawtio:type=security,area=jmx,name=HawtioTestJMXSecurity')
  })

  test('there are multiple ACLMBeans', async () => {
    jolokiaService.search = jest.fn(async () => [
      'hawtio:type=security,area=jmx,name=HawtioDummyJMXSecurity',
      'hawtio:type=security,area=jmx,name=HawtioTestJMXSecurity',
      'io.test:type=security,area=jmx,name=AnotherJMXSecurity',
    ])

    const rbacService = new __testing__.RBACService()
    await expect(rbacService.getACLMBean()).resolves.toBe('hawtio:type=security,area=jmx,name=HawtioTestJMXSecurity')
  })
})
