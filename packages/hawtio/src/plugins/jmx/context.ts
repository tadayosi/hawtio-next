import { EVENT_REFRESH, eventService } from '@hawtiosrc/core'
import { PluginNodeSelectionContext } from '@hawtiosrc/plugins'
import { MBeanNode, MBeanTree, workspace } from '@hawtiosrc/plugins/shared'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { To, useNavigate, useSearchParams } from 'react-router-dom'
import { log, PARAM_KEY_NODE_ID, pluginName, pluginPath } from './globals'

/**
 * Custom React hook for using JMX MBean tree.
 */
export function useMBeanTree() {
  const [tree, setTree] = useState(MBeanTree.createEmpty(pluginName))
  const [loaded, setLoaded] = useState(false)
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  /*
   * Need to preserve the selected node between re-renders since the
   * populateTree function called via the refresh listener does not
   * cache the value and stores it as null
   */
  const refSelectedNode = useRef<MBeanNode | null>()
  refSelectedNode.current = selectedNode

  const populateTree = async () => {
    const wkspTree = await workspace.getTree()
    setTree(wkspTree)

    const nodeId = searchParams.get(PARAM_KEY_NODE_ID)
    if (nodeId && nodeId !== refSelectedNode.current?.id) {
      log.debug('Restore selected node with nid:', nodeId)
      // Try to restore node from URL
      const urlNode = wkspTree.find(node => node.id === nodeId)
      if (urlNode) {
        setSelectedNode(urlNode)
        refSelectedNode.current = urlNode
      } else {
        // Clear nid as it is invalid
        log.debug('Clear invalid nid:', nodeId)
        searchParams.delete(PARAM_KEY_NODE_ID)
        setSearchParams(searchParams)
      }
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
      navigate(pluginPathWithNodeId(newSelected, searchParams))
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

/**
 * Build URL query string with nid parameter, preserving other existing params
 * @param node - The node to encode
 * @param searchParams - The current URL search params to preserve, defaults to the ones from the window location
 */
export function pluginPathWithNodeId(
  node: MBeanNode,
  searchParams: URLSearchParams = new URLSearchParams(window.location.search),
): Partial<To> {
  searchParams.set(PARAM_KEY_NODE_ID, node.id)
  const query = `?${searchParams.toString()}`
  return { pathname: pluginPath, search: query }
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
