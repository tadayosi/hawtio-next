import { MBeanTree } from '__root__/shared/tree'
import { workspace } from './workspace'

jest.mock('__root__/connect/jolokia-service')

describe('workspace', () => {
  test('getting the tree', async () => {
    const tree: MBeanTree = await workspace.getTree()
    expect(tree.isEmpty()).toBeFalsy()
    expect(tree.get('java.util.logging')).toBeDefined()
    expect(tree.get('quartz')).toBeDefined()
    expect(tree.get('org.apache.camel')).toBeDefined()
  })

  test('has mbeans', async () => {
    const response: boolean = await workspace.hasMBeans()
    expect(response).toBeTruthy()
  })

  test('tree contains domain', async () => {
    await expect(workspace.treeContainsDomainAndProperties('quartz')).resolves.toBeTruthy()
  })

  test('tree does not contain domain', async () => {
    await expect(workspace.treeContainsDomainAndProperties('not.a.domain')).resolves.toBeFalsy()
  })

  test('tree contains domain with properties', async () => {
    await expect(
      workspace.treeContainsDomainAndProperties('quartz', { id: 'quartz', name: 'quartz' }),
    ).resolves.toBeTruthy()
    await expect(
      workspace.treeContainsDomainAndProperties('quartz', { id: 'QuartzScheduler', name: 'QuartzScheduler' }),
    ).resolves.toBeTruthy()
    await expect(
      workspace.treeContainsDomainAndProperties('quartz', { id: 'SomeRandomChild', name: 'NoThisChildIsNotHere' }),
    ).resolves.toBeFalsy()
  })

  test('parseMBean', () => {
    const testdata = [
      { on: 'jolokia:type=Config', r: { attributes: { type: 'Config' }, domain: 'jolokia' } },
      {
        on: 'jdk.management.jfr:type=FlightRecorder',
        r: { attributes: { type: 'FlightRecorder' }, domain: 'jdk.management.jfr' },
      },
      {
        on: 'jboss.threads:name="XNIO-1",type=thread-pool',
        r: { attributes: { name: '"XNIO-1"', type: 'thread-pool' }, domain: 'jboss.threads' },
      },
      {
        on: 'org.apache.camel:context=SampleCamelLog4J,type=context,name="SampleCamelLog4J"',
        r: {
          attributes: { context: 'SampleCamelLog4J', name: '"SampleCamelLog4J"', type: 'context' },
          domain: 'org.apache.camel',
        },
      },
    ]

    for (const td of testdata) {
      expect(workspace.parseMBean(td.on)).toEqual(td.r)
    }
  })
})
