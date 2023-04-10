import React from 'react'
import Split from 'react-split'
import {
  EmptyState,
  EmptyStateIcon,
  EmptyStateVariant,
  PageSection,
  PageSectionVariants,
  Spinner,
  Title,
} from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons'
import { CamelTreeView } from './CamelTreeView'
import { CamelContent } from './CamelContent'
import { useCamelTree, CamelContext } from './context'
import './Camel.css'

export const Camel: React.FunctionComponent = () => {
  const { tree, loaded, selectedNode, setSelectedNode } = useCamelTree()

  if (!loaded) {
    return (
      <PageSection>
        <Spinner isSVG aria-label='Loading Camel Contexts tree' />
      </PageSection>
    )
  }

  if (tree.isEmpty()) {
    return (
      <PageSection variant={PageSectionVariants.light}>
        <EmptyState variant={EmptyStateVariant.full}>
          <EmptyStateIcon icon={CubesIcon} />
          <Title headingLevel='h1' size='lg'>
            No Camel Contexts found
          </Title>
        </EmptyState>
      </PageSection>
    )
  }

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
