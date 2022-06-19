import { PageSection, PageSectionVariants, Text, TextContent } from '@patternfly/react-core'
import React from 'react'
import { actions } from '../../hawtio/ui/page/reducer'
import store from '../../hawtio/store'
import { Plugin } from '../../hawtio/ui/page/state'

type Example1Props = {
}

const Example1: React.FunctionComponent<Example1Props> = props =>
  <PageSection variant={PageSectionVariants.light}>
    <TextContent>
      <Text component="h1">Example 1</Text>
      <Text component="p">This is an example plugin.</Text>
    </TextContent>
  </PageSection>

store.dispatch(actions.registerPlugin(
  new Plugin('Example 1', '/example1', Example1)))

export default Example1
