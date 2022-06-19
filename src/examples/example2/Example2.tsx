import { PageSection, PageSectionVariants, Text, TextContent } from '@patternfly/react-core'
import React from 'react'
import store from '../../hawtio/store'
import { actions } from '../../hawtio/ui/page/reducer'
import { Plugin } from '../../hawtio/ui/page/state'

type Example2Props = {
}

const Example2: React.FunctionComponent<Example2Props> = props =>
  <PageSection variant={PageSectionVariants.light}>
    <TextContent>
      <Text component="h1">Example 2</Text>
      <Text component="p">This is another example plugin.</Text>
    </TextContent>
  </PageSection>

store.dispatch(actions.registerPlugin(
  new Plugin('Example 2', '/example2', Example2)))

export default Example2
