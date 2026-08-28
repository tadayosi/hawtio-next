import { EVENT_REFRESH, eventService } from '@hawtiosrc/core'
import { PluginNodeSelectionContext } from '@hawtiosrc/plugins'
import { MBeanNode, MBeanTree, workspace } from '@hawtiosrc/plugins/shared'
import { createContext, startTransition, useContext, useEffect, useState } from 'react'
import { type To, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PARAM_KEY_NODE_ID, pluginName, pluginPath } from './globals'

/**
 * Custom React hook to use and manage the JMX MBean tree. This hook combines:
 * * top-level context for the "selected node"
 * * own state for the tree (taken from the `workspace` into the React state) and its loading status
 * * effect for managing the synchronization with `nid` query parameter for the selected node
 * * effect for loading the tree and refreshing it based on the background change (TreeWatcher)
 */
export function useMBeanTree() {
  // the top-level state declared at HawtioPage level which contains global "selected node" state
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)

  // Jmx plugin specific state containing the full Jmx tree available outside the React state
  const [tree, setTree] = useState(MBeanTree.createEmpty(pluginName))
  const [loaded, setLoaded] = useState(false)

  // hooks from React Router to synchronize selected node with `nid` query parameter (in both directions)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // this effect loads the tree - both at initial render and when the tree is refreshed (by TreeWatcher)
  // outside of React
  useEffect(() => {
    let apply = true
    const loadTree = async () => {
      // Jmx plugin has easiest job when taking the tree into the React state.
      // other plugins are using a subtree or even may create a brand new one based on some nodes
      const tree = await workspace.getTree()
      if (apply) {
        setTree(tree)
        setLoaded(true)
      }
    }

    const listener = () => {
      setLoaded(false)
      apply = true
      loadTree()
    }
    eventService.onRefresh(listener)

    loadTree()

    return () => {
      apply = false
      eventService.removeListener(EVENT_REFRESH, listener)
    }
  }, [])

  // another effect synchronizes the `nid` query parameter and the global state for "selected node"
  useEffect(() => {
    const nid = searchParams.get('nid')
    if (selectedNode && (!nid || nid !== selectedNode.id)) {
      setSearchParams(
        params => {
          // reflect the selected node in query parameter
          params.set('nid', selectedNode.id)
          return params
        },
        { replace: true },
      )
      // we don't have to navigate() - setSearchParams does it underneath (in React transition)
      return
    }
    if (loaded) {
      if (!selectedNode && nid) {
        // reflect the query parameter in selected node
        const found = tree.find(node => node.id === nid)
        if (found) {
          tree.forEach(found.path(), n => {
            workspace.expand(true, n)
          })
          setSelectedNode(found)
        } else {
          searchParams.delete('nid')
          navigate({ pathname: pluginPath, search: searchParams.toString() }, { replace: true })
        }
      }
    }
  }, [pathname, search, loaded, tree, selectedNode, setSelectedNode, navigate, searchParams, setSearchParams])

  // this effect navigates the tree and expands relevant nodes if the selected node changes
  useEffect(() => {
    if (selectedNode) {
      // the selected node may come from plugins that build a tree view from the "main" tree.
      // if the nodes preserve the IDs, we may selected related node in the main tree by searching
      // for actual node by id
      const treeNode = tree.find(node => node.id === selectedNode.id)
      if (treeNode) {
        const path = [...treeNode.path()]
        tree.forEach(path, n => {
          workspace.expand(true, n)
        })
        // important to reselect the node upon refresh to point to a new instance
        // with the same ID and path
        if (!Object.is(treeNode, selectedNode)) {
          startTransition(() => {
            setSelectedNode(treeNode)
          })
          navigate({ pathname: pluginPath, search: searchParams.toString() }, { replace: true })
        }
      }
    }
  }, [tree, selectedNode, setSelectedNode, navigate, searchParams])

  return { tree, loaded, selectedNode, setSelectedNode }
}

/**
 * Build URL query string with `nid` parameter, preserving other existing params
 * @param node The node to encode
 * @param pathname the path to use for the prepared URL
 * @param searchParams The current URL search params to preserve, defaults to the ones from the window location
 */
export function pluginPathWithNodeId(
  node: MBeanNode,
  pathname: string,
  searchParams: URLSearchParams = new URLSearchParams(window.location.search),
): Partial<To> {
  searchParams.set(PARAM_KEY_NODE_ID, node.id)
  return { pathname, search: searchParams.toString() }
}

/**
 * Type for the state accessed by `useContext(MBeanTreeContext)`.
 */
type MBeanTreeContext = {
  tree: MBeanTree
  selectedNode: MBeanNode | null
  setSelectedNode: (selected: MBeanNode | null) => void
}

/**
 * The Jmx context with default values to be shared and accessed by the split tree/content for Jmx plugin.
 */
export const MBeanTreeContext = createContext<MBeanTreeContext>({
  tree: MBeanTree.createEmpty(pluginName),
  selectedNode: null,
  setSelectedNode: () => {
    /* no-op */
  },
})

/**
 * Helper hook for accessing MBeanTreeContext data in a safe way
 */
export function useMBeanTreeContext() {
  const ctx = useContext(MBeanTreeContext)
  if (!ctx) {
    throw new Error('Call useMBeanTreeContext() only within <MBeanTreeContext.Provider>')
  }
  return ctx
}
