import { createContext, useEffect, useState, useContext, useRef } from 'react'
import { PluginNodeSelectionContext } from '__root__'
import { workspace, MBeanNode, MBeanTree } from '__root__/shared'
import { pluginName, pluginPath } from './globals'
import { eventService, EVENT_REFRESH } from '@hawtio/react/core'
import { TreeViewDataItem } from '@patternfly/react-core'
import { useNavigate } from 'react-router-dom'

/**
 * Custom React hook for using JMX MBean tree.
 */
export function useMBeanTree() {
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
    setTree(wkspTree)

    if (!refSelectedNode.current) return

    const path = [...refSelectedNode.current.path()]

    // Expand the nodes to redisplay the path
    wkspTree.forEach(path, (node: MBeanNode) => {
      const tvd = node as TreeViewDataItem
      tvd.defaultExpanded = true
    })

    // Ensure the new version of the selected node is selected
    const newSelected = wkspTree.navigate(...path)
    if (newSelected) setSelectedNode(newSelected)

    /* On population of tree, ensure the url path is returned to the base plugin path */
    navigate(pluginPath)
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

type MBeanTreeContext = {
  tree: MBeanTree
  selectedNode: MBeanNode | null
  setSelectedNode: (selected: MBeanNode | null) => void
}

export const MBeanTreeContext = createContext<MBeanTreeContext>({
  tree: MBeanTree.createEmpty(pluginName),
  selectedNode: null,
  setSelectedNode: () => {
    /* no-op */
  },
})
