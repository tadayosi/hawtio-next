import { EVENT_REFRESH, eventService } from '@hawtiosrc/core'
import { PluginNodeSelectionContext } from '@hawtiosrc/plugins'
import { MBeanNode, MBeanTree, workspace } from '@hawtiosrc/plugins/shared'
import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { type To, useLocation, useNavigate, useSearchParams } from 'react-router'
import { jmxDomain, pluginName, pluginPath } from './globals'
import { PARAM_KEY_NODE_ID } from '@hawtiosrc/plugins/jmx/globals'

/**
 * Custom React hook for using Camel MBean tree.
 */
export function useCamelTree() {
  // the top-level state declared at HawtioPage level which contains global "selected node" state
  // this is shared with other plugins using the tree
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)

  // Camel plugin specific state containing the partial Jmx tree available outside the React state
  const [tree, setTree] = useState(MBeanTree.createEmpty(pluginName))
  // tree loading may happen in the background and "loaded" reflects the state of (re)load
  const [loaded, setLoaded] = useState(false)
  // "initial" flag though is cleared only once. When displayed for the first time
  // when navigating to Camel plugin we expand default folders, but we should not do it on background reload
  const [initial, setInitial] = useState(true)

  // hooks from React Router to synchronize selected node with `nid` query parameter (in both directions)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const camelContext = useRef<MBeanNode | null>(null)

  // Normally (as with global Jmx tree) we just need to call `await workspace.getTree()`, but
  // with Camel, we need a subtree from the Camel domain
  const populateTree = useCallback(async (): Promise<MBeanTree | null> => {
    const wkspTree: MBeanTree = await workspace.getTree()

    const camelDomainNode = wkspTree.find(node => node.name === jmxDomain)
    if (!(camelDomainNode && camelDomainNode.children && camelDomainNode.children.length > 0)) {
      // there's no Camel domain in JMX tree or the domain doesn't contain any MBean folders
      // (or folders added by Camel's tree processor)
      // Redirect to the JMX view as fallback
      eventService.notify({
        type: 'warning',
        message: 'No Camel domain detected in target. Redirecting to back to jmx.',
      })
      navigate({ pathname: '/jmx', search }, { replace: true })
      return null
    }

    // As of Camel 3 we can have only one Camel Context per application
    // https://camel.apache.org/manual/camel-3-migration-guide.html#_main_class_2

    // Camel domain should contain (after tree processing) a single "Camel Contexts" grouping folder
    const contextsNode = camelDomainNode.getChildren()[0]
    // and there should be only one Camel context underneath
    const parentContext = contextsNode?.getChildren()[0]
    if (!contextsNode || !parentContext) {
      eventService.notify({
        type: 'warning',
        message: 'No Camel contexts detected in target. Redirecting to back to jmx.',
      })
      navigate({ pathname: '/jmx', search }, { replace: true })
      return null
    }

    // remember the reference for the main Camel Context node which should be a grandchild
    // of the Camel domain node (with a child being "Camel Contexts" grouping node)
    // this is what refs are for - to share data between effects and event handlers
    camelContext.current = parentContext

    // Using the camel domain nodes from the original tree means it is the same
    // node as that that appears in the workspace tree
    // There should be only one actual Camel context - contextsNode.getChildren() should be of length=1
    return MBeanTree.createFromNodes(pluginName, [parentContext])
  }, [navigate, search])

  // this effect loads the tree - both at initial render and when the tree is refreshed (by TreeWatcher)
  // outside of React
  useEffect(() => {
    let apply = true
    const loadTree = async () => {
      // Jmx plugin just calls "await workspace.getTree()", but we need only part of it
      const tree = await populateTree()
      if (apply) {
        if (tree) {
          setTree(tree)
        }
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
      workspace.clearExpandAll(jmxDomain)
    }
  }, [populateTree])

  // synchronize the `nid` query parameter and the global state for "selected node"
  useEffect(() => {
    const nid = searchParams.get('nid')
    if (selectedNode && (!nid || nid !== selectedNode.id)) {
      setSearchParams(params => {
        // reflect the selected node in query parameter
        params.set('nid', selectedNode.id)
        return params
      }, { replace: true })
      // we don't have to navigate() - setSearchParams does it underneath (in React transition)
      return
    }
    if (loaded) {
      // first, as with Jmx plugin, we'll try to get the selected node from `nid` query parameter
      // but we won't immediately set the found node as selected, because it may not be from Camel domain
      let selectedFromQuery: MBeanNode | null = null
      if (!selectedNode && nid) {
        const found = tree.find(node => node.id === nid)
        if (found) {
          const path = found.path()
          selectedFromQuery = tree.navigate(...path.slice(2))
        }
      }

      // all nodes from other JMX namespaces and additionally "org.apache.camel" and "Camel Contexts"
      // nodes are not displayed in Camel tree, so w ignore the "nid" parameter

      let selectedCamelNode = null
      let s = selectedFromQuery ?? selectedNode
      while (s) {
        if (s.id === camelContext.current?.id) {
          selectedCamelNode = selectedFromQuery ?? selectedNode
          break
        }
        s = s.parent
      }

      const ctx = camelContext.current

      if (!selectedCamelNode && ctx) {
        // nid didn't point to anything we can select for Camel tab, so lets do the default selection
        // when Camel is displayed for the first time
        if (initial) {
          workspace.expandAll(false, jmxDomain)
          workspace.clearExpandAll(jmxDomain)
          // always expand the context tree
          workspace.expand(true, ctx)
          workspace.expand(true, ctx.parent!)

          // always expand the "special" folders under the context
          ctx.children?.forEach(child => {
            switch (child.name) {
              case 'routes':
              case 'endpoints':
              case 'components':
                workspace.expand(true, child)
                break
            }
          })

          // whatever was selected, we select "routes"
          const path = [...ctx.path(), 'routes']
          const selected = tree.navigate(...path.slice(2))
          if (selected) {
            tree.forEach(path, n => {
              workspace.expand(true, n)
            })
            startTransition(() => {
              setSelectedNode(selected)
            })
            searchParams.delete('nid')
            // navigate(pluginPathWithNodeId(selected, pluginPath, searchParams), { replace: true })
          }
        }
      } else if (selectedCamelNode) {
        // nid points to some existing node in in the Camel tree
        tree.forEach(selectedCamelNode.path(), n => {
          workspace.expand(true, n)
        })
        startTransition(() => {
          setSelectedNode(selectedCamelNode)
        })
        // navigate(pluginPathWithNodeId(selectedCamelNode, pluginPath, searchParams), { replace: true })
      } else {
        // there may be a selected node, but not from Camel or it may be Camel domain or "Camel Contexts" group
        startTransition(() => {
          setSelectedNode(null)
        })
        searchParams.delete('nid')
        navigate({ pathname: pluginPath, search: searchParams.toString() }, { replace: true })
      }
      startTransition(() => {
        setInitial(false)
      })
    }
  }, [pathname, search, loaded, tree, selectedNode, setSelectedNode, navigate, searchParams, setSearchParams, initial])

  // this effect navigates the tree and expands relevant nodes if the selected node changes
  useEffect(() => {
    if (selectedNode) {
      const path = [...selectedNode.path()]
      // Ensure the new version of the selected node is selected in the reloaded tree
      const newSelected = tree.navigate(...path.slice(2))
      if (newSelected) {
        tree.forEach(path, n => {
          workspace.expand(true, n)
        })
        workspace.expand(true, selectedNode.parent!)
        workspace.expand(true, selectedNode.parent!.parent!)
        // important to reselect the node upon refresh to point to a new instance
        // with the same ID and path
        if (!Object.is(newSelected, selectedNode)) {
          setSelectedNode(newSelected)
        }
      }
    }
  }, [tree, selectedNode, setSelectedNode])

  return { tree, loaded, selectedNode, setSelectedNode }
}

/**
 * Build URL query string with `nid` parameter, preserving other existing params
 * TODO: there's the same function in packages/hawtio/src/plugins/jmx/context.ts
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
  const query = `?${searchParams.toString()}`
  // encodeURIComponent encodes more characters than encodeURI, but we want some characters back
  return { pathname, search: query.replaceAll('%2F', '/') }
}

/**
 * Type for the state accessed by `useContext(CamelContext)`.
 */
type CamelContext = {
  tree: MBeanTree
  selectedNode: MBeanNode | null
  setSelectedNode: (selected: MBeanNode | null) => void
}

/**
 * The Camel tree (subtree of the entire Jmx tree) context with default values to be shared
 * and accessed by the split tree/content for Camel plugin.
 */
export const CamelContext = createContext<CamelContext>({
  tree: MBeanTree.createEmpty(pluginName),
  selectedNode: null,
  setSelectedNode: () => {
    /* no-op */
  },
})

/**
 * Helper hook for accessing CamelContext data in a safe way
 */
export function useCamelContext() {
  const ctx = useContext(CamelContext)
  if (!ctx) {
    throw new Error('Call useCamelContext() only within <CamelContext.Provider>')
  }
  return ctx
}
