import {
  EmptyState,
  EmptyStateIcon,
  EmptyStateVariant,
  PageSection,
  PageSectionVariants,
  Spinner,
  EmptyStateHeader,
} from '@patternfly/react-core'
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
    return (
      <PageSection>
        <Spinner aria-label='Loading MBean tree' />
      </PageSection>
    )
  }

  if (tree.isEmpty()) {
    return (
      <PageSection variant={PageSectionVariants.light}>
        <EmptyState variant={EmptyStateVariant.full}>
          <EmptyStateHeader titleText='No MBeans found' icon={<EmptyStateIcon icon={CubesIcon} />} headingLevel='h1' />
        </EmptyState>
      </PageSection>
    )
  }

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
