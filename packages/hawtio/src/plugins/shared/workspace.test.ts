import { userService } from '@hawtiosrc/auth'
import { MBeanTree } from '@hawtiosrc/plugins/shared/tree'
import { workspace } from './workspace'

jest.mock('@hawtiosrc/plugins/shared/jolokia-service')

describe('workspace', () => {
  beforeAll(async () => {
    // Set up the test to be under login state
    await userService.fetchUser()
  })

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
      workspace.treeContainsDomainAndProperties('quartz', {
        id: 'quartz-QuartzScheduler',
        name: 'QuartzScheduler',
      }),
    ).resolves.toBeTruthy()
    await expect(
      workspace.treeContainsDomainAndProperties('quartz', { id: 'SomeRandomChild', name: 'NoThisChildIsNotHere' }),
    ).resolves.toBeFalsy()
  })

  test('findMBeans', async () => {
    const tests = [
      { domain: 'jolokia', properties: { type: 'Config' }, expected: 1 },
      { domain: 'java.lang', properties: { type: 'Memory' }, expected: 1 },
      { domain: 'org.apache.camel', properties: { context: 'SampleCamel', type: 'context' }, expected: 1 },
      {
        domain: 'org.apache.camel',
        properties: { context: 'SampleCamel', type: 'components', name: 'q*' },
        expected: 1,
      },
      {
        domain: 'org.apache.camel',
        properties: { context: 'SampleCamel', type: 'components', name: 'z*' },
        expected: 0,
      },
      {
        domain: 'org.apache.camel',
        properties: { context: 'SampleCamel', type: 'endpoints' },
        expected: 4,
      },
    ]

    for (const test of tests) {
      await expect(workspace.findMBeans(test.domain, test.properties)).resolves.toHaveLength(test.expected)
    }
  })
})
