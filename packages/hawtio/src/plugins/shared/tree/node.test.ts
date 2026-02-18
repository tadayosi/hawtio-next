import { userService } from '@hawtiosrc/auth'
import { workspace } from '../workspace'
import { Icons, MBeanNode, PropertyList } from './node'
import { MBeanTree } from './tree'

jest.mock('@hawtiosrc/plugins/shared/jolokia-service')

describe('MBeanNode', () => {
  let tree: MBeanTree

  beforeAll(async () => {
    // Set up the test to be under login state
    await userService.fetchUser()
  })

  beforeEach(async () => {
    tree = await workspace.getTree()
    workspace.refreshTree()
  })

  test('populateMBean', () => {
    const mbean = {
      desc: 'Managed CamelContext',
      attr: {
        CamelId: {
          rw: false,
          type: 'java.lang.String',
          desc: 'Camel ID',
        },
        CamelVersion: {
          rw: false,
          type: 'java.lang.String',
          desc: 'Camel Version',
        },
        ExchangesTotal: {
          rw: false,
          type: 'long',
          desc: 'Total number of exchanges',
        },
        Redeliveries: {
          rw: false,
          type: 'long',
          desc: 'Number of redeliveries (internal only)',
        },
      },
      op: {
        getCamelId: {
          args: [],
          ret: 'java.lang.String',
          desc: 'CamelId',
        },
        start: {
          args: [],
          ret: 'void',
          desc: 'Start Camel',
        },
        stop: {
          args: [],
          ret: 'void',
          desc: 'Stop Camel (shutdown)',
        },
        sendBody: {
          args: [
            {
              name: 'p1',
              type: 'java.lang.String',
              desc: '',
            },
            {
              name: 'p2',
              type: 'java.lang.Object',
              desc: '',
            },
          ],
          ret: 'void',
          desc: 'Send body (in only)',
        },
      },
      canInvoke: true,
    }

    const node1 = new MBeanNode(null, 'test.node', false)
    node1.populateMBean('context=SampleContext,type=context,name="SampleCamel"', mbean)
    expect(node1.icon).toBe(Icons.folder)
    expect(node1.expandedIcon).toBe(Icons.folderOpen)
    expect(node1.children).toHaveLength(1)

    let child1 = node1.children?.[0]
    expect(child1?.name).toEqual('SampleContext')
    expect(child1?.icon).toBe(Icons.folder)
    expect(child1?.expandedIcon).toBe(Icons.folderOpen)
    expect(child1?.children).toHaveLength(1)

    child1 = child1?.children?.[0]
    expect(child1?.name).toEqual('context')
    expect(child1?.icon).toBe(Icons.folder)
    expect(child1?.expandedIcon).toBe(Icons.folderOpen)
    expect(child1?.children).toHaveLength(1)

    child1 = child1?.children?.[0]
    expect(child1?.name).toEqual('SampleCamel')
    expect(child1?.mbean).toBe(mbean)
    expect(child1?.icon).toBe(Icons.mbean)
    expect(child1?.expandedIcon).toBeUndefined()
    expect(child1?.children).toBeUndefined()

    // When canInvoke is false
    mbean.canInvoke = false
    const node2 = new MBeanNode(null, 'test.node', false)
    node2.populateMBean('context=SampleContext,type=context,name="SampleCamel"', mbean)

    const child2 = node2.children?.[0]?.children?.[0]?.children?.[0]
    expect(child2?.name).toEqual('SampleCamel')
    expect(child2?.mbean).toBe(mbean)
    expect(child2?.icon).toBe(Icons.locked)
    expect(child2?.expandedIcon).toBeUndefined()
    expect(child2?.children).toBeUndefined()
  })

  test('removeChildren', async () => {
    const nodes = tree.getTree()
    expect(nodes.length).toBeGreaterThan(0)

    const camel = tree.get('org.apache.camel') as MBeanNode
    const count = camel.childCount()
    const orphans = camel.removeChildren()
    expect(orphans.length).toEqual(count)
    expect(camel.childCount()).toEqual(0)
    for (const o of orphans) {
      expect(o.parent).toBeNull()
    }
  })

  test('checking the tree nodes have parents', async () => {
    const nodes = tree.getTree()
    expect(nodes.length).toBeGreaterThan(0)

    const logging = tree.get('java.util.logging') as MBeanNode
    expect(logging).not.toBeNull()
    expect(logging.parent).toBeNull()

    const camel = tree.get('org.apache.camel') as MBeanNode
    expect(camel).not.toBeNull()
    expect(camel.parent).toBeNull()
    const sc = camel.get('SampleCamel', true) as MBeanNode
    expect(sc).not.toBeNull()
    expect(sc.parent).toBe(camel)
    const comp = sc.get('components', true) as MBeanNode
    expect(comp).not.toBeNull()
    expect(comp.parent).toBe(sc)
  })

  test('match', async () => {
    // MBean: org.apache.camel:context=SampleCamel,type=context,name="SampleCamel"
    const folder = tree.navigate('org.apache.camel', 'SampleCamel', 'context') as MBeanNode
    expect(folder).not.toBeNull()
    const mbean = folder.findChildren('SampleCamel')[0] as MBeanNode
    expect(mbean).not.toBeUndefined()

    // Folder shouldn't match anything
    expect(folder.match({})).toBe(false)

    // Empty properties always match
    expect(mbean.match({})).toBe(true)

    expect(mbean.match({ context: 'SampleCamel' })).toBe(true)
    expect(mbean.match({ context: 'SampleCamel', type: 'context' })).toBe(true)
    expect(mbean.match({ context: 'SampleCamel', type: 'context', name: 'SampleCamel' })).toBe(true)
    expect(mbean.match({ context: 'SampleCamel', type: 'context', name: 'SampleCamel', key1: 'value1' })).toBe(false)

    expect(mbean.match({ context: 'Sample*', type: 'context', name: 'SampleCamel' })).toBe(true)
    expect(mbean.match({ context: '*Camel', type: 'context', name: 'SampleCamel' })).toBe(true)
    expect(mbean.match({ context: 'Sample*amel', type: 'context', name: 'SampleCamel' })).toBe(true)
    expect(mbean.match({ context: 'Sample*amel2', type: 'context', name: 'SampleCamel' })).toBe(false)

    expect(mbean.match({ context: 'SampleCamel', type: 'c*t', name: 'SampleCamel' })).toBe(true)
    expect(mbean.match({ context: 'SampleCamel', type: 'c*t2', name: 'SampleCamel' })).toBe(false)
    expect(mbean.match({ context: 'SampleCamel', type: 'context', name: 'Sample*' })).toBe(true)
    expect(mbean.match({ context: 'SampleCamel', type: 'context', name: '*Camel2' })).toBe(false)
  })

  test('navigate', async () => {
    const domainNode = tree.get('org.apache.camel') as MBeanNode
    expect(domainNode).not.toBeNull()

    let path = ['org.apache.camel', 'SampleCamel', 'components', 'quartz']
    let qNode = domainNode.navigate(...path) as MBeanNode
    expect(qNode).not.toBeNull()
    expect(qNode.id).toBe('org.apache.camel-SampleCamel-components-quartz')

    path = ['org.apache.camel', 'SampleCame*', 'c*ponents', '*artz']
    qNode = domainNode.navigate(...path) as MBeanNode
    expect(qNode).not.toBeNull()
    expect(qNode.id).toBe('org.apache.camel-SampleCamel-components-quartz')
  })

  test('forEach', async () => {
    const domainNode = tree.get('org.apache.camel') as MBeanNode
    expect(domainNode).not.toBeNull()

    let path = ['org.apache.camel', 'SampleCamel', 'components', 'quartz']
    let counter = 0
    domainNode.forEach(path, _ => (counter = counter + 1))
    expect(counter).toEqual(path.length)

    path = ['org.apache.camel', 'SampleCame*', 'c*ponents', '*artz']
    counter = 0
    domainNode.forEach(path, _ => (counter = counter + 1))
    expect(counter).toEqual(path.length)
  })

  test('findAncestors', async () => {
    const camelNode = tree.get('org.apache.camel') as MBeanNode
    expect(camelNode).not.toBeNull()
    expect(camelNode.id).toBe('org.apache.camel-folder')

    const ctxNode = camelNode.getIndex(0) as MBeanNode
    expect(ctxNode).not.toBeNull()
    expect(ctxNode.id).toBe('org.apache.camel-SampleCamel-folder')
    expect(ctxNode.name).toBe('SampleCamel')

    const compNode = ctxNode.get('components', true) as MBeanNode
    expect(compNode).not.toBeNull()
    expect(compNode.id).toBe('org.apache.camel-SampleCamel-components-folder')

    const chain: string[] = [camelNode.name, ctxNode.name]
    expect(compNode.findAncestors().map((n: MBeanNode) => n.name)).toEqual(chain)
  })

  test('findAncestor', async () => {
    const tree: MBeanTree = await workspace.getTree()
    const camelNode = tree.get('org.apache.camel') as MBeanNode
    expect(camelNode).not.toBeNull()
    expect(camelNode.id).toBe('org.apache.camel-folder')

    const ctxNode = camelNode.getIndex(0) as MBeanNode
    expect(ctxNode).not.toBeNull()
    expect(ctxNode.id).toBe('org.apache.camel-SampleCamel-folder')
    expect(ctxNode.name).toBe('SampleCamel')

    const compNode = ctxNode.get('components', true) as MBeanNode
    expect(compNode).not.toBeNull()
    expect(compNode.id).toBe('org.apache.camel-SampleCamel-components-folder')

    expect(compNode.findAncestor((node: MBeanNode) => node.name === ctxNode.name)).toBe(ctxNode)
    expect(compNode.findAncestor((node: MBeanNode) => node.name === camelNode.name)).toBe(camelNode)
  })

  test('adopt', async () => {
    const tree: MBeanTree = await workspace.getTree()
    const camelNode = tree.get('org.apache.camel') as MBeanNode
    expect(camelNode).not.toBeNull()
    expect(camelNode.id).toBe('org.apache.camel-folder')

    const newCtx = new MBeanNode(null, 'TestNode', false)
    expect(newCtx.parent).toBeNull()

    camelNode.adopt(newCtx)
    expect(camelNode.get('TestNode', false)).toBe(newCtx)
    expect(newCtx.parent).toBe(camelNode)
  })
})

describe('PropertyList', () => {
  test('objectName', () => {
    const node = new MBeanNode(null, 'org.apache.camel', false)
    const propList = new PropertyList(node, 'context=SampleContext,type=context,name="SampleCamel"')
    expect(propList.objectName()).toEqual('org.apache.camel:context=SampleContext,type=context,name="SampleCamel"')
  })

  test('getPaths', () => {
    const node1 = new MBeanNode(null, 'java.lang', false)
    const propList1 = new PropertyList(node1, 'name=Metaspace,type=MemoryPool')
    expect(propList1.getPaths()).toEqual(['MemoryPool', 'Metaspace'])

    const node2 = new MBeanNode(null, 'org.apache.camel', false)
    const propList2 = new PropertyList(node2, 'context=SampleContext,type=context,name="SampleCamel"')
    expect(propList2.getPaths()).toEqual(['SampleContext', 'context', 'SampleCamel'])
  })

  test('getPaths for special domains', () => {
    // osgi.compendium
    const osgiCompendiumNode = new MBeanNode(null, 'osgi.compendium', false)
    const osgiCompendiumPropList = new PropertyList(
      osgiCompendiumNode,
      'name=Name1,framework=Framework1,service=Service1,version=Version1',
    )
    expect(osgiCompendiumPropList.getPaths()).toEqual(['Service1', 'Version1', 'Framework1', 'Name1'])

    // osgi.core
    const osgiCoreNode = new MBeanNode(null, 'osgi.core', false)
    const osgiCorePropList = new PropertyList(
      osgiCoreNode,
      'name=Name1,framework=Framework1,type=Type1,version=Version1',
    )
    expect(osgiCorePropList.getPaths()).toEqual(['Type1', 'Version1', 'Framework1', 'Name1'])
  })
})
