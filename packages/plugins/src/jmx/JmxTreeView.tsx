import { TreeView, TreeViewDataItem } from '@patternfly/react-core'
import React, { ChangeEvent, useContext, useEffect, useState } from 'react'
import { PluginTreeViewToolbar, MBeanNode, MBeanTree } from '__root__/shared'
import { MBeanTreeContext } from './context'
import './JmxTreeView.css'
import { useNavigate } from 'react-router-dom'
import { pluginPath } from './globals'

/**
 * Expansion requires more than 2 states since the expandAll
 * must be removed completely to defer to the expanded state
 * of each data node
 */
enum ExpansionValue {
  /**
   * should revert to the expanded state of the data
   */
  Default,
  /**
   * all data should be expanded
   */
  ExpandAll,
  /**
   * all data should be collapsed
   */
  CollapseAll,
}

export const JmxTreeView: React.FunctionComponent = () => {
  const { tree, selectedNode, setSelectedNode } = useContext(MBeanTreeContext)
  const [expanded, setExpanded] = useState(ExpansionValue.Default)
  const [filteredTree, setFilteredTree] = useState(tree.getTree())
  const navigate = useNavigate()

  /**
   * Listen for changes to the tree that may occur as a result
   * of events being monitored by the Tree:Watcher in workspace
   * eg. new endpoint being created
   */
  useEffect(() => {
    setFilteredTree(tree.getTree())
  }, [tree])

  const onSearch = (event: ChangeEvent<HTMLInputElement>) => {
    // Ensure no node from the 'old' filtered is lingering
    setSelectedNode(null)
    setExpanded(ExpansionValue.Default)
    const input = event.target.value

    if (!input) setFilteredTree(tree.getTree())

    const treeElements = MBeanTree.filter(tree.getTree(), node => node.name.toLowerCase().includes(input.toLowerCase()))

    if (treeElements.length === 0) setFilteredTree(tree.getTree())
    else {
      setFilteredTree(treeElements)
      setExpanded(ExpansionValue.ExpandAll)
    }
  }

  const onSelect = (event: React.MouseEvent<Element, MouseEvent>, item: TreeViewDataItem) => {
    setSelectedNode(item as MBeanNode)
    /* On change of node selection update the url to the base plugin path */
    navigate(pluginPath)
  }

  const setAllExpanded = (value: boolean) => {
    setExpanded(value ? ExpansionValue.ExpandAll : ExpansionValue.CollapseAll)
  }

  const expandedProp = (): object => {
    switch (expanded) {
      case ExpansionValue.ExpandAll:
        return { allExpanded: true }
      case ExpansionValue.CollapseAll:
        return { allExpanded: false }
      default:
        return {}
    }
  }

  return (
    <TreeView
      id='jmx-tree-view'
      data={filteredTree}
      hasGuides={true}
      hasSelectableNodes={true}
      activeItems={selectedNode ? [selectedNode] : []}
      {...expandedProp()}
      onSelect={onSelect}
      toolbar={<PluginTreeViewToolbar onSearch={onSearch} onSetExpanded={setAllExpanded} />}
    />
  )
}
