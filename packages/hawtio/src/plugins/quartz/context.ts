import { EVENT_REFRESH, eventService } from '@hawtiosrc/core'
import { PluginNodeSelectionContext } from '@hawtiosrc/plugins'
import { MBeanNode, MBeanTree, workspace } from '@hawtiosrc/plugins/shared'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { log, pluginName } from './globals'
import { QuartzIcon } from './icons'
import { quartzService } from './quartz-service'

/**
 * Custom React hook for using Quartz Scheduler MBeans.
 */
export function useQuartz() {
  // the top-level state declared at HawtioPage level which contains global "selected node" state
  const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)

  // Jmx plugin specific state containing the full Jmx tree available outside the React state
  const [tree, setTree] = useState(MBeanTree.createEmpty(pluginName))
  const [loaded, setLoaded] = useState(false)

  const populateTree = useCallback(async (): Promise<MBeanTree | null> => {
    const schedulers = (await quartzService.searchSchedulers()).map(node => {
      const scheduler = node.copyTo(node.getProperty('name') ?? node.name)
      scheduler.icon = QuartzIcon
      // copy ID, so we can synchronize selection between Quartz and Jmx views
      scheduler.id = node.id
      return scheduler
    })
    log.debug('Found schedulers:', schedulers)
    // we can simply select the first one
    setSelectedNode(schedulers[0] ?? null)
    // and expand related folders to avoid edge cases when navigating to (global) Jmx tree
    // and not see the tree expanded
    if (schedulers[0]) {
      workspace.getTree().then(tree => {
        const node = tree.find(n => n.id === schedulers[0]!.id)
        if (node) {
          tree.forEach(node.path(), n => {
            workspace.expand(true, n)
          })
        }
      })
    }
    return MBeanTree.createFromNodes(pluginName, schedulers)
  }, [setSelectedNode])

  // this effect loads the tree - both at initial render and when the tree is refreshed (by TreeWatcher)
  // outside of React
  useEffect(() => {
    let apply = true
    const loadTree = async () => {
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
    }
  }, [populateTree])

  return { tree, loaded, selectedNode, setSelectedNode }
}

type QuartzContext = {
  tree: MBeanTree
  selectedNode: MBeanNode | null
  setSelectedNode: (selected: MBeanNode | null) => void
}

export const QuartzContext = createContext<QuartzContext>({
  tree: MBeanTree.createEmpty(pluginName),
  selectedNode: null,
  setSelectedNode: () => {
    // no-op
  },
})
