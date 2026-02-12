import { EVENT_REFRESH, eventService } from '@hawtiosrc/core'
import { PluginNodeSelectionContext } from '@hawtiosrc/plugins'
import { MBeanNode, MBeanTree, workspace } from '@hawtiosrc/plugins/shared'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { log, pluginName, pluginPath } from './globals'
import { buildNidUrl, decodeNodePath, PARAM_KEY_NODE } from './utils'

/**
 * Custom React hook for using JMX MBean tree.
 */
export function useMBeanTree() {
  const [tree, setTree] = useState(MBeanTree.createEmpty(pluginName))
  const [loaded, setLoaded] = useState(false)
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  /*
   * Need to preserve the selected node between re-renders since the
   * populateTree function called via the refresh listener does not
   * cache the value and stores it as null
   */
  const refSelectedNode = useRef<MBeanNode | null>()
  refSelectedNode.current = selectedNode

  /**
   * Restore the selected node from the URL parameter if present
   */
  const restoreNodeFromUrl = (wkspTree: MBeanTree, nodeIdParam: string | null): MBeanNode | null => {
    if (!nodeIdParam) return null

    try {
      const path = decodeNodePath(nodeIdParam)
      const node = wkspTree.navigate(...path)

      if (node) {
        // Expand ancestors to make the node visible
        wkspTree.forEach(path, n => {
          n.defaultExpanded = true
        })
      }

      return node
    } catch (error) {
      log.error('Failed to restore node from URL:', error)
      return null
    }
  }

  const populateTree = async () => {
    const wkspTree: MBeanTree = await workspace.getTree()
    setTree(wkspTree)

    const nodeId = searchParams.get(PARAM_KEY_NODE)

    // Try to restore node from URL
    const urlNode = restoreNodeFromUrl(wkspTree, nodeId)
    if (urlNode) {
      setSelectedNode(urlNode)
      return
    }

    // If the URL contained a nid param, it was invalid. Clear it and reset to base path.
    if (nodeId) {
      const currentSearchParams = new URLSearchParams(window.location.search)
      currentSearchParams.delete(PARAM_KEY_NODE)
      const query = currentSearchParams.toString()
      navigate(`${pluginPath}${query ? `?${query}` : ''}`)
    }

    if (!refSelectedNode.current) return

    const path = [...refSelectedNode.current.path()]

    // Expand the nodes to redisplay the path
    wkspTree.forEach(path, node => {
      node.defaultExpanded = true
    })

    // Ensure the new version of the selected node is selected
    const newSelected = wkspTree.navigate(...path)
    if (newSelected) {
      setSelectedNode(newSelected)
      // Reset to base path with nid to sync URL with restored selection
      navigate(buildNidUrl(path, pluginPath))
    } else {
      // Node no longer exists - clear selection and go to base path
      navigate(pluginPath)
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
