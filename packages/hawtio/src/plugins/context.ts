import React, { createContext, useState } from 'react'
import { MBeanNode } from '@hawtiosrc/plugins/shared'

/**
 * Custom React hook for declaring a shared state for keeping currently selected MBeanNode. This state is
 * used only in `<HawtioPage>` component even if currently selected plugin does not deal with JMX and the tree.
 *
 * It's a responsibility of a particular plugin to display the tree available from the `workspace` service. Jmx
 * plugin takes the entire tree, while plugins as Camel or ArtemisJmx (external) take only selected domain. The
 * important thing is that the tree is loaded from Jolokia outside any React component. From the performance
 * and consistency point of view it is very important to precisely define where the "selected node" is stored.
 *
 * This hook holds:
 * * a state for `selectedNode` react value. All plugins using the tree from the `workspace` share the selected node.
 *
 * This hook doesn't synchronize with any external service. Even if _some_ plugins may reflect the selected node
 * in a query parameter (like `nid` for node_id), it is optional and not relevant at this stage.
 */
export function usePluginNodeSelected() {
  const [selectedNode, setSelectedNode] = useState<MBeanNode | null>(null)
  return { selectedNode, setSelectedNode }
}

/**
 * Type for the state created by `usePluginNodeSelected()` and accessed by `useContext(PluginNodeSelectionContext)`.
 *
 * It is a common pattern to define a type for the data to be used with React's `createContext` and name it exactly
 * as the exported context variable itself (created by `createContext()`).
 */
export type PluginNodeSelectionContext = {
  /** {@link MBeanNode} selected in the JMX tree, stored in `usePluginNodeSelected` hook's state. */
  selectedNode: MBeanNode | null
  /** State setter for currently selected JMX node. */
  setSelectedNode: React.Dispatch<React.SetStateAction<MBeanNode | null>>
}

/**
 * PluginNodeSelectionContext gives access to:
 * * selected node in the global JMX tree (from `workspace`)
 * * function to set currently selected node (state setter function)
 *
 * This context is _provided_ in top level `<HawtioPage>` component and the values come from
 * `usePluginNodeSelected` hook. It is the accessed using `useContext(PluginNodeSelectionContext)`.
 */
export const PluginNodeSelectionContext = createContext<PluginNodeSelectionContext>({
  selectedNode: null,
  setSelectedNode: () => {
    /* no-op */
  },
})
