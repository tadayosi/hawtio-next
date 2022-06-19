import { PageSection, PageSectionVariants, Text, TextContent } from '@patternfly/react-core'
import React from 'react'
import store from '../../hawtio/store'
import { actions } from '../../hawtio/ui/page/reducer'
import { Plugin } from '../../hawtio/ui/page/state'

type Example3Props = {
}

const Example3: React.FunctionComponent<Example3Props> = props =>
  <PageSection variant={PageSectionVariants.light}>
    <TextContent>
      <Text component="h1">Example 3</Text>
      <Text component="p">This is yet another example plugin.</Text>
    </TextContent>
  </PageSection>

store.dispatch(actions.registerPlugin(
  new Plugin('Example 3', '/example3', Example3)))

export default Example3
