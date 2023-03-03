import { MBeanNode } from './node'
import { treeProcessorRegistry } from './processor-registry'
import { MBeanTree } from './tree'

describe('MBeanTree', () => {
  beforeEach(() => {
    treeProcessorRegistry.reset()
  })

  test('flatten empty tree', async () => {
    const tree = MBeanTree.createFromNodes('test', [])
    expect(tree.flatten()).toEqual({})
  })

  test('flatten tree', async () => {
    const child1 = createNode('test', 'child1', 'child1', 'test:type=folder1,name=child1')
    const child2 = createNode('test', 'child2', 'child2', 'test:type=folder1,name=child2')
    const child3 = createNode('test', 'child3', 'child3', 'test:type=folder1,name=child3')
    const folder1 = createFolder('test', 'folder1', 'folder1', [child1, child2, child3])
    const node1 = createNode('test', 'node1', 'node1', 'test:name=node1')
    const node2 = createNode('test', 'node2', 'node2', 'test:name=node2')
    const tree = MBeanTree.createFromNodes('test', [folder1, node1, node2])

    expect(tree.flatten()).toEqual({
      'test:type=folder1,name=child1': child1,
      'test:type=folder1,name=child2': child2,
      'test:type=folder1,name=child3': child3,
      'test:name=node1': node1,
      'test:name=node2': node2,
    })
  })
})

function createNode(owner: string, id: string, name: string, objectName: string): MBeanNode {
  const node = new MBeanNode(owner, id, name, false)
  node.objectName = objectName
  return node
}

function createFolder(owner: string, id: string, name: string, children: MBeanNode[]): MBeanNode {
  const folder = new MBeanNode(owner, id, name, true)
  folder.children = children
  return folder
}
