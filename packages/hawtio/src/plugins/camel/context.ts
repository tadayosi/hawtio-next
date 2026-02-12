import { EVENT_REFRESH, eventService } from '@hawtiosrc/core'
import { PluginNodeSelectionContext } from '@hawtiosrc/plugins'
import { MBeanNode, MBeanTree, workspace } from '@hawtiosrc/plugins/shared'
import { type TreeViewDataItem } from '@patternfly/react-core'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as camelService from './camel-service'
import { jmxDomain, pluginName, pluginPath } from './globals'

/**
 * Custom React hook for using Camel MBean tree.
 */
export function useCamelTree() {
  const [tree, setTree] = useState(MBeanTree.createEmpty(pluginName))
  const [loaded, setLoaded] = useState(false)
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)
  const { pathname, search } = useLocation()
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
    const rootNode = wkspTree.find(node => node.name === jmxDomain)
    if (rootNode && rootNode.children && rootNode.children.length > 0) {
      const contextsNode = rootNode.getChildren()[0]
      if (!contextsNode) {
        return
      }

      /*
       * Using the camel domain nodes from the original tree means it is the same
       * node as that that appears in the workspace tree
       */
      const subTree: MBeanTree = MBeanTree.createFromNodes(pluginName, contextsNode.getChildren())
      setTree(subTree)

      const path: string[] = []
      /*
       * Make the selection the camel selected node if
       * - It is not null
       * - It is a camel domain node
       * - It is not the domain node (not visible)
       */
      if (
        refSelectedNode.current &&
        camelService.hasDomain(refSelectedNode.current) &&
        !camelService.isDomainNode(refSelectedNode.current)
      ) {
        path.push(...refSelectedNode.current.path())
      } else {
        // No selection so select the routes node under the contexts to display
        // the route diagrams for all the routes as the default view
        path.push(...contextsNode.path(), 'routes')
      }

      const parentContext = contextsNode.children?.[0]
      if (parentContext) {
        // expand the context tree
        parentContext.defaultExpanded = true

        // check whether to expand its children
        parentContext.children?.forEach(child => {
          switch (child.name) {
            case 'routes':
            case 'endpoints':
            case 'components':
              child.defaultExpanded = true
              break
          }
        })
      }

      // Expand the nodes to redisplay the path
      rootNode.forEach(path, (node: MBeanNode) => {
        const tvd = node as TreeViewDataItem
        tvd.defaultExpanded = true
      })

      // Ensure the new version of the selected node is selected
      const newSelected = rootNode.navigate(...path)
      if (newSelected) setSelectedNode(newSelected)

      // On population of tree, ensure the url path is returned to the base plugin path.
      // If the location is already in the Camel plugin, skip navigation.
      if (!pathname.startsWith(pluginPath)) {
        navigate(`${pluginPath}${search}`)
      }
    } else {
      setTree(wkspTree)
      // No camel contexts so redirect to the JMX view and select the first tree node
      navigate(`/jmx${search}`)
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
