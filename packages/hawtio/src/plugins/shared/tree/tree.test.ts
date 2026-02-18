import { userService } from '@hawtiosrc/auth'
import { escapeHtmlId } from '@hawtiosrc/util/htmls'
import { workspace } from '../workspace'
import { MBEAN_NODE_ID_SEPARATOR, MBeanNode } from './node'
import { treeProcessorRegistry } from './processor-registry'
import { MBeanTree } from './tree'

jest.mock('@hawtiosrc/plugins/shared/jolokia-service')

describe('MBeanTree', () => {
  let wkspTree: MBeanTree

  beforeAll(async () => {
    // Set up the test to be under login state
    await userService.fetchUser()
  })

  beforeEach(async () => {
    wkspTree = await workspace.getTree()
    workspace.refreshTree()
    treeProcessorRegistry.reset()
  })

  test('createFromDomains should process empty domains', async () => {
    const tree = await MBeanTree.createFromDomains('test', {})
    expect(tree.getTree()).toEqual([])
  })

  test('createFromDomains should process domains', async () => {
    // Test data taken from https://github.com/hawtio/hawtio-react/issues/377
    const domains = {
      'org.xnio': {
        'type=Xnio,provider="nio"': { desc: '' },
        'type=Xnio,provider="nio",worker="XNIO-1"': { desc: '' },
        'type=Xnio,provider="nio",worker="XNIO-1",address="/0:0:0:0:0:0:0:0:10000"': { desc: '' },
        'type=Xnio,provider="nio",worker="XNIO-2"': { desc: '' },
        'type=Xnio,provider="nio",worker="XNIO-2",address="/0:0:0:0:0:0:0:0:10001"': { desc: '' },
      },
    }
    const tree = (await MBeanTree.createFromDomains('test', domains)).getTree()

    expect(tree.length).toEqual(1)

    const rootFolder = tree[0] as MBeanNode
    expect(rootFolder.id).toEqual('org.xnio-folder')
    expect(rootFolder.name).toEqual('org.xnio')
    expect(rootFolder.mbean).toBeUndefined()
    expect(rootFolder.childCount()).toEqual(1)

    const xnioFolder = rootFolder.getChildren()[0] as MBeanNode
    expect(xnioFolder.id).toEqual('org.xnio-Xnio-folder')
    expect(xnioFolder.name).toEqual('Xnio')
    expect(xnioFolder.mbean).toBeUndefined()
    expect(xnioFolder.childCount()).toEqual(2) // 1 folder & 1 mbean

    const nioFolder = xnioFolder.getChildren()[0] as MBeanNode
    expect(nioFolder.id).toEqual('org.xnio-Xnio-nio-folder')
    expect(nioFolder.name).toEqual('nio')
    expect(nioFolder.mbean).toBeUndefined()
    expect(nioFolder.childCount()).toEqual(4) // 2 folder & 2 mbean

    const nioMBean = xnioFolder.getChildren()[1] as MBeanNode
    expect(nioMBean.id).toEqual('org.xnio-Xnio-nio')
    expect(nioMBean.name).toEqual('nio')
    expect(nioMBean.mbean).toBeDefined()
    expect(nioMBean.childCount()).toEqual(0)

    const xnio1Folder = nioFolder.getChildren()[0] as MBeanNode
    expect(xnio1Folder.id).toEqual('org.xnio-Xnio-nio-XNIO-1-folder')
    expect(xnio1Folder.name).toEqual('XNIO-1')
    expect(xnio1Folder.mbean).toBeUndefined()
    expect(xnio1Folder.childCount()).toEqual(1)

    const xnio1MBean = nioFolder.getChildren()[1] as MBeanNode
    expect(xnio1MBean.id).toEqual('org.xnio-Xnio-nio-XNIO-1')
    expect(xnio1MBean.name).toEqual('XNIO-1')
    expect(xnio1MBean.mbean).toBeDefined()
    expect(xnio1MBean.childCount()).toEqual(0)

    const xnio2Folder = nioFolder.getChildren()[2] as MBeanNode
    expect(xnio2Folder.id).toEqual('org.xnio-Xnio-nio-XNIO-2-folder')
    expect(xnio2Folder.name).toEqual('XNIO-2')
    expect(xnio2Folder.mbean).toBeUndefined()
    expect(xnio2Folder.childCount()).toEqual(1)

    const xnio2MBean = nioFolder.getChildren()[3] as MBeanNode
    expect(xnio2MBean.id).toEqual('org.xnio-Xnio-nio-XNIO-2')
    expect(xnio2MBean.name).toEqual('XNIO-2')
    expect(xnio2MBean.mbean).toBeDefined()
    expect(xnio2MBean.childCount()).toEqual(0)

    const xnio1Addr = xnio1Folder.getChildren()[0] as MBeanNode
    expect(xnio1Addr.id).toEqual('org.xnio-Xnio-nio-XNIO-1-/0:0:0:0:0:0:0:0:10000')
    expect(xnio1Addr.name).toEqual('/0:0:0:0:0:0:0:0:10000')
    expect(xnio1Addr.mbean).toBeDefined()
    expect(xnio1Addr.childCount()).toEqual(0)

    const xnio2Addr = xnio2Folder.getChildren()[0] as MBeanNode
    expect(xnio2Addr.id).toEqual('org.xnio-Xnio-nio-XNIO-2-/0:0:0:0:0:0:0:0:10001')
    expect(xnio2Addr.name).toEqual('/0:0:0:0:0:0:0:0:10001')
    expect(xnio2Addr.mbean).toBeDefined()
    expect(xnio2Addr.childCount()).toEqual(0)
  })

  test('createFromDomains should be robust in presence of malformed mbeans', async () => {
    const domains = {
      'java.lang': { 'type=Memory': { desc: '' } },
      'malformed.mbean': { '': { desc: '' } },
    }
    const tree = (await MBeanTree.createFromDomains('test', domains)).getTree()

    expect(tree.length).toEqual(2)

    const javaLang = tree[0] as MBeanNode
    expect(javaLang.id).toEqual('java.lang-folder')
    expect(javaLang.name).toEqual('java.lang')
    expect(javaLang.mbean).toBeUndefined()
    expect(javaLang.childCount()).toEqual(1)

    const memory = javaLang.getChildren()[0] as MBeanNode
    expect(memory.id).toEqual('java.lang-Memory')
    expect(memory.name).toEqual('Memory')
    expect(memory.mbean).toBeDefined()
    expect(memory.childCount()).toEqual(0)

    const malformed = tree[1] as MBeanNode
    expect(malformed.id).toEqual('malformed.mbean-folder')
    expect(malformed.name).toEqual('malformed.mbean')
    expect(malformed.mbean).toBeUndefined()
    expect(malformed.childCount()).toEqual(0)
  })

  test('flatten empty tree', () => {
    const tree = MBeanTree.createFromNodes('test', [])
    expect(tree.flatten()).toEqual({})
  })

  test('flatten tree', () => {
    const child1 = createNode('child1', 'test:type=folder1,name=child1')
    const child2 = createNode('child2', 'test:type=folder1,name=child2')
    const child3 = createNode('child3', 'test:type=folder1,name=child3')
    const folder1 = createFolder('folder1', [child1, child2, child3])
    const node1 = createNode('node1', 'test:name=node1')
    const node2 = createNode('node2', 'test:name=node2')
    const tree = MBeanTree.createFromNodes('test', [folder1, node1, node2])

    expect(tree.flatten()).toEqual({
      'test:type=folder1,name=child1': child1,
      'test:type=folder1,name=child2': child2,
      'test:type=folder1,name=child3': child3,
      'test:name=node1': node1,
      'test:name=node2': node2,
    })
  })

  test('findMBeans', () => {
    expect(wkspTree.findMBeans('no.such.domain', {})).toHaveLength(0)
    expect(wkspTree.findMBeans('java.util.logging', {})).toHaveLength(1)
    expect(wkspTree.findMBeans('org.apache.camel', { context: 'NoSuchContext' })).toHaveLength(0)
    expect(wkspTree.findMBeans('org.apache.camel', { type: 'components' })).toHaveLength(4)
    expect(wkspTree.findMBeans('org.apache.camel', { type: 'components', name: 'q*' })).toHaveLength(1)
  })

  test('navigate', () => {
    let path = ['org.apache.camel', 'SampleCamel', 'components', 'quartz']
    let qNode = wkspTree.navigate(...path) as MBeanNode
    expect(qNode).not.toBeNull()
    expect(qNode.id).toBe('org.apache.camel-SampleCamel-components-quartz')

    path = ['org.apache.camel', 'SampleCame*', 'c*ponents', '*artz']
    qNode = wkspTree.navigate(...path) as MBeanNode
    expect(qNode).not.toBeNull()
    expect(qNode.id).toBe('org.apache.camel-SampleCamel-components-quartz')
  })

  test('forEach', () => {
    let path = ['org.apache.camel', 'SampleCamel', 'components', 'quartz']
    let counter = 0
    wkspTree.forEach(path, _ => (counter = counter + 1))
    expect(counter).toEqual(path.length)

    path = ['org.apache.camel', 'SampleCame*', 'c*ponents', '*artz']
    counter = 0
    wkspTree.forEach(path, _ => (counter = counter + 1))
    expect(counter).toEqual(path.length)
  })

  test('IDs should be concatenation of {parent}-({element}[-folder]) on domain tree', () => {
    const allNodes: MBeanNode[] = []
    const recursivelyGetAllNodesOnTree = (tree: MBeanNode[]) => {
      tree.forEach((node: MBeanNode) => {
        allNodes.push(node)
        recursivelyGetAllNodesOnTree(node.getChildren())
      })
    }
    const getExpectedIdRecursivelyFromParentNode = (node: MBeanNode): string => {
      const idSeparator = MBEAN_NODE_ID_SEPARATOR
      const currentNodeExpectedPartOfId = escapeHtmlId(node.name)

      if (!node.parent) return currentNodeExpectedPartOfId
      return getExpectedIdRecursivelyFromParentNode(node.parent) + idSeparator + currentNodeExpectedPartOfId
    }
    recursivelyGetAllNodesOnTree(wkspTree.getTree())

    allNodes.forEach(node => {
      const folderDenomination = '-folder'
      expect(node.id).toEqual(
        getExpectedIdRecursivelyFromParentNode(node) + (node.children !== undefined ? folderDenomination : ''),
      )
    })
  })

  test('IDs should be concatenation of {parent}-({element}[-folder]) on mock tree', () => {
    // The object names are dummies because they are not used for the ids.
    const treeNodes = [
      createFolder('mbean1', [
        createFolder('mbean1-1', [
          createFolder('mbean1-1-1', [
            createNode('mbean1-1-1-1', 'objectName1-1-1-1'),
            createNode('mbean1-1-1-2', 'objectName1-1-1-2'),
          ]),
          createNode('mbean1-1-2', 'objectName1-1-2'),
          createNode('mbean1-1-3', 'objectName1-1-3'),
        ]),
        createNode('mbean1-2', 'objectName1-2'),
        createFolder('mbean1-3', [createNode('mbean1-3-1', 'objectName1-3-1')]),
      ]),
      createFolder('mbean2', [createNode('mbean2-1', 'objectName2-1'), createNode('mbean2-2', 'objectName2-2')]),
      createNode('mbean3', 'objectName3'),
    ]

    const pathToExpectedIds = [
      {
        path: ['mbean1'],
        expectedId: 'mbean1-folder',
      },
      {
        path: ['mbean1', 'mbean1-1'],
        expectedId: 'mbean1-mbean1-1-folder',
      },
      {
        path: ['mbean1', 'mbean1-1', 'mbean1-1-1'],
        expectedId: 'mbean1-mbean1-1-mbean1-1-1-folder',
      },
      {
        path: ['mbean1', 'mbean1-1', 'mbean1-1-1', 'mbean1-1-1-1'],
        expectedId: 'mbean1-mbean1-1-mbean1-1-1-mbean1-1-1-1',
      },
      {
        path: ['mbean1', 'mbean1-1', 'mbean1-1-1', 'mbean1-1-1-2'],
        expectedId: 'mbean1-mbean1-1-mbean1-1-1-mbean1-1-1-2',
      },
      {
        path: ['mbean1', 'mbean1-1', 'mbean1-1-2'],
        expectedId: 'mbean1-mbean1-1-mbean1-1-2',
      },
      {
        path: ['mbean1', 'mbean1-1', 'mbean1-1-3'],
        expectedId: 'mbean1-mbean1-1-mbean1-1-3',
      },
      {
        path: ['mbean1', 'mbean1-2'],
        expectedId: 'mbean1-mbean1-2',
      },
      {
        path: ['mbean1', 'mbean1-3'],
        expectedId: 'mbean1-mbean1-3-folder',
      },
      {
        path: ['mbean1', 'mbean1-3', 'mbean1-3-1'],
        expectedId: 'mbean1-mbean1-3-mbean1-3-1',
      },
      {
        path: ['mbean2'],
        expectedId: 'mbean2-folder',
      },
      {
        path: ['mbean2', 'mbean2-1'],
        expectedId: 'mbean2-mbean2-1',
      },
      {
        path: ['mbean2', 'mbean2-2'],
        expectedId: 'mbean2-mbean2-2',
      },
      {
        path: ['mbean3'],
        expectedId: 'mbean3',
      },
    ]

    const tree = MBeanTree.createFromNodes('thisIdIsNotUsedForMBeanIds', treeNodes)

    pathToExpectedIds.forEach(({ path, expectedId }) => {
      expect(tree.navigate(...path)?.id).toEqual(expectedId)
    })
  })
})

/*
 * Test helpers
 */

function createNode(name: string, objectName: string): MBeanNode {
  const node = new MBeanNode(null, name, false)
  node.objectName = objectName
  // Ids will be revisited. Check PR #378 (https://github.com/hawtio/hawtio-react/pull/378)
  node.initId(false)
  return node
}

function createFolder(name: string, children: MBeanNode[]): MBeanNode {
  const folder = new MBeanNode(null, name, true)
  children.forEach(child => folder.adopt(child))
  // Ids will be revisited. Check PR #378 (https://github.com/hawtio/hawtio-react/pull/378)
  folder.initId(true)
  return folder
}
