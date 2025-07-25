import { Icon, Tooltip } from '@patternfly/react-core'
import { HelpIcon } from '@patternfly/react-icons/dist/esm/icons/help-icon'

export const TooltipHelpIcon: React.FunctionComponent<{ tooltip: string }> = ({ tooltip }) => (
  <Icon size='md'>
    <Tooltip content={tooltip}>
      <HelpIcon />
    </Tooltip>
  </Icon>
)
