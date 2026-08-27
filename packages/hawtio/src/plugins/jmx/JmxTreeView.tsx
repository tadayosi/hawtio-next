import { ExpansionValue, MBeanNode, MBeanTree, PluginTreeViewToolbar, workspace } from '@hawtiosrc/plugins/shared'
import { TreeView, TreeViewDataItem } from '@patternfly/react-core'
import React, { ChangeEvent, startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import './JmxTreeView.css'
import { pluginPathWithNodeId, useMBeanTreeContext } from './context'
import { pluginPath } from '@hawtiosrc/plugins/jmx/globals'

export const JmxTreeView: React.FunctionComponent = () => {
  const { tree, selectedNode, setSelectedNode } = useMBeanTreeContext()
  const [allExpanded, setAllExpanded] = useState(workspace.allExpanded())
  const [filteredTree, setFilteredTree] = useState(tree.getTree())

  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // A little trick for keeping the filter upon tree refresh. This ref is _not_ passed with "ref" attribute
  // of a React component, instead it's set in first usage of search control
  const inputRef = useRef<HTMLInputElement>()

  const applyFilter = useCallback((filter: string) => {
    if (!filter || filter === '') {
      setFilteredTree(tree.getTree())
    } else {
      const treeElements = MBeanTree.filter(tree.getTree(), node => node.name.toLowerCase().includes(filter.toLowerCase()))

      if (treeElements.length === 0) {
        setFilteredTree(tree.getTree())
        setAllExpanded(ExpansionValue.Default)
      } else {
        setFilteredTree(treeElements)
        setAllExpanded(ExpansionValue.ExpandAll)
      }
    }
  }, [tree])

  /**
   * Listen for changes to the tree that may occur as a result
   * of events being monitored by the Tree:Watcher in workspace
   * eg. new endpoint being created
   */
  useEffect(() => {
    startTransition(() => {
      setFilteredTree(tree.getTree())
    })

    if (inputRef.current) {
      // it's available only if user searches something in the first place
      applyFilter(inputRef.current.value)
    }
  }, [tree, applyFilter])

  const onSearch = (event: ChangeEvent<HTMLInputElement>) => {
    // Ensure no node from the 'old' filtered is lingering
    startTransition(() => {
      setSelectedNode(null)
    })
    if (searchParams.has('nid')) {
      // prevent nid-selectedNode synchronization effects from running
      setSearchParams(params => {
        params.delete('nid')
        return params
      })
    }
    // instead of letting React set the ref to <input> with "ref" attribute, we initialize
    // it from the event.target. If user searches anything, tree reload effect will have access to the filter
    // otherwise there's nothing to filter by.
    const input = event.target.value
    if (inputRef.current == null) {
      inputRef.current = event.target
    }
    applyFilter(input)
  }

  const onSelect = (_event: React.MouseEvent<Element, MouseEvent>, item: TreeViewDataItem) => {
    const node = item as MBeanNode
    workspace.expand(true, node)
    setAllExpanded(ExpansionValue.Default)
    // change selected mode using a transition to match the update priority of React Router's navigation
    // (and related router state changes)
    startTransition(() => {
      setSelectedNode(node)
    })

    // Underneath setSearchParams(), react router is calling navigate("?" + newSearchParams, navigateOptions)
    // but we need to get back to the main path, so default /jmx route will navigate to relevant subpath
    navigate(pluginPathWithNodeId(node, pluginPath, searchParams), { replace: true })
  }

  const expand = (expanded: boolean, item: MBeanNode) => {
    workspace.expand(expanded, item)
    // clear the status, so Patternfly again relies on individual node status
    setAllExpanded(ExpansionValue.Default)
  }

  const onExpand = (_event: React.MouseEvent<Element, MouseEvent>, item: TreeViewDataItem) => {
    expand(true, item as MBeanNode)
  }

  const onCollapse = (_event: React.MouseEvent<Element, MouseEvent>, item: TreeViewDataItem) => {
    expand(false, item as MBeanNode)
  }

  const onAllExpanded = (expanded: boolean) => {
    workspace.expandAll(expanded)
    setAllExpanded(expanded ? ExpansionValue.ExpandAll : ExpansionValue.CollapseAll)
    if (!expanded) {
      // set selected node to null within React's transition, because navigate (and setSearchParams) from React
      // Router also uses transition lanes
      startTransition(() => {
        setSelectedNode(null)
      })
      // navigation needed here, because we have to tell React Router to remove
      // the `nid` parameter from its location related state
      searchParams.delete('nid')
      navigate({ pathname: pluginPath, search: searchParams.toString() }, { replace: true })
    }
  }

  const expandedProp = (): object => {
    switch (allExpanded) {
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
      onExpand={onExpand}
      onCollapse={onCollapse}
      toolbar={<PluginTreeViewToolbar onSearch={onSearch} onSetExpanded={onAllExpanded} />}
    />
  )
}
