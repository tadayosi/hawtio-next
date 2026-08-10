import { EmptyState, EmptyStateVariant, PageSection, Spinner } from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon'
import React from 'react'
import Split from 'react-split'
import { MBeanTreeContext, useMBeanTree } from './context'
import './Jmx.css'
import { JmxContent } from './JmxContent'
import { JmxTreeView } from './JmxTreeView'

export const Jmx: React.FunctionComponent = () => {
  const { tree, loaded, selectedNode, setSelectedNode } = useMBeanTree()

  if (!loaded) {
    // the tree is not loaded yet
    return (
      <PageSection hasBodyWrapper={false}>
        <Spinner aria-label='Loading MBean tree' />
      </PageSection>
    )
  }

  if (tree.isEmpty()) {
    // the tree is empty, so no need to show the split tree/content UI
    return (
      <PageSection hasBodyWrapper={false}>
        <EmptyState
          headingLevel='h1'
          icon={CubesIcon}
          titleText='No MBeans found'
          variant={EmptyStateVariant.full}
        ></EmptyState>
      </PageSection>
    )
  }

  // actual UI that's showing synchronized tree/content UI. Both the tree and the content
  // can access the shared state (tree, selected node) using useMBeanTreeContext() hook
  return (
    <MBeanTreeContext.Provider value={{ tree, selectedNode, setSelectedNode }}>
      <Split className='jmx-split' sizes={[30, 70]} minSize={200} gutterSize={5}>
        <div>
          <JmxTreeView />
        </div>
        <div>
          <JmxContent />
        </div>
      </Split>
    </MBeanTreeContext.Provider>
  )
}
