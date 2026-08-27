import { EmptyState, EmptyStateVariant, PageSection, Spinner } from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon'
import React from 'react'
import Split from 'react-split'
import './Camel.css'
import { CamelContent } from './CamelContent'
import { CamelTreeView } from './CamelTreeView'
import { CamelContext, useCamelTree } from './context'

export const Camel: React.FunctionComponent = () => {
  const { tree, loaded, selectedNode, setSelectedNode } = useCamelTree()

  if (!loaded) {
    // the tree is not loaded yet
    return (
      <PageSection hasBodyWrapper={false}>
        <Spinner aria-label='Loading Camel Contexts tree' />
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
          titleText='No Camel Contexts found'
          variant={EmptyStateVariant.full}
        ></EmptyState>
      </PageSection>
    )
  }

  // actual UI that's showing synchronized tree/content UI. Both the tree and the content
  // can access the shared state (tree, selected node) using useMBeanTreeContext() hook
  return (
    <CamelContext.Provider value={{ tree, selectedNode, setSelectedNode }}>
      <Split className='camel-split' sizes={[25, 75]} minSize={200} gutterSize={5}>
        <div>
          <CamelTreeView />
        </div>
        <div>
          <CamelContent />
        </div>
      </Split>
    </CamelContext.Provider>
  )
}
