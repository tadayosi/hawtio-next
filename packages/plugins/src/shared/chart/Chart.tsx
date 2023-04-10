import {
  EmptyState,
  EmptyStateIcon,
  EmptyStateVariant,
  PageSection,
  PageSectionVariants,
  Title,
} from '@patternfly/react-core'
import { ClipboardCheckIcon } from '@patternfly/react-icons'
import { useContext } from 'react'
import { PluginNodeSelectionContext } from '__root__/selectionNodeContext'

export const Chart: React.FunctionComponent = () => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)

  if (!selectedNode || !selectedNode.mbean) {
    return null
  }

  return (
    <PageSection variant={PageSectionVariants.light} isFilled>
      <EmptyState variant={EmptyStateVariant.full}>
        <EmptyStateIcon icon={ClipboardCheckIcon} />
        <Title headingLevel='h1' size='lg'>
          Under construction
        </Title>
      </EmptyState>
    </PageSection>
  )
}
