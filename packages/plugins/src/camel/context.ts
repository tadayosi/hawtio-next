import { createContext, useEffect, useState, useContext, useRef } from 'react'
import { TreeViewDataItem } from '@patternfly/react-core'
import { PluginNodeSelectionContext } from '__root__/selectionNodeContext'
import { workspace, MBeanNode, MBeanTree } from '__root__/shared'
import { pluginName, pluginPath, jmxDomain } from './globals'
import { useNavigate } from 'react-router-dom'
import { eventService, EVENT_REFRESH } from '@hawtio/react/core'

/**
 * Custom React hook for using Camel MBean tree.
 */
export function useCamelTree() {
  const [tree, setTree] = useState(MBeanTree.createEmpty(pluginName))
  const [loaded, setLoaded] = useState(false)
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)
  const navigate = useNavigate()

  /*
   * Need to preserve the selected node between re-renders since the
   * populateTree function called via the refresh listener does not
   * cache the value and stores it as null
   */
  const refSelectedNode = useRef<MBeanNode | null>()
  refSelectedNode.current = selectedNode

  const populateTree = async () => {
    const wkspTree: MBeanTree = await workspace.getTree()
    const rootNode = wkspTree.findDescendant(node => node.name === jmxDomain)
    if (rootNode) {
      /*
       * Using the camel domain node from the original tree means it is the same
       * node as that that appears in the workspace tree
       */
      const subTree: MBeanTree = MBeanTree.createFromNodes(pluginName, [rootNode])
      setTree(subTree)
      if (rootNode && rootNode.children && rootNode.children.length > 0) {
        const path: string[] = []
        if (refSelectedNode.current) {
          path.push(...refSelectedNode.current.path())
        } else {
          path.push(...rootNode.getChildren()[0].path())
        }

        // Expand the nodes to redisplay the path
        rootNode.forEach(path, (node: MBeanNode) => {
          const tvd = node as TreeViewDataItem
          tvd.defaultExpanded = true
        })

        // Ensure the new version of the selected node is selected
        const newSelected = rootNode.navigate(...path)
        if (newSelected) setSelectedNode(newSelected)

        /* On population of tree, ensure the url path is returned to the base plugin path */
        navigate(pluginPath)
      }
    } else {
      setTree(wkspTree)
      // No camel contexts so redirect to the JMX view and select the first tree node
      navigate('jmx')
      eventService.notify({
        type: 'warning',
        message: 'No Camel domain detected in target. Redirecting to back to jmx.',
      })
    }
  }

  useEffect(() => {
    const loadTree = async () => {
      await populateTree()
      setLoaded(true)
    }

    const listener = () => {
      setLoaded(false)
      loadTree()
    }
    eventService.onRefresh(listener)

    loadTree()

    return () => eventService.removeListener(EVENT_REFRESH, listener)
    /*
     * This effect should only be called on mount so cannot depend on selectedNode
     * But cannot have [] removed either as this seems to execute the effect repeatedly
     * So disable the lint check.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { tree, loaded, selectedNode, setSelectedNode }
}

type CamelContext = {
  tree: MBeanTree
  selectedNode: MBeanNode | null
  setSelectedNode: (selected: MBeanNode | null) => void
}

export const CamelContext = createContext<CamelContext>({
  tree: MBeanTree.createEmpty(pluginName),
  selectedNode: null,
  setSelectedNode: () => {
    /* no-op */
  },
})
