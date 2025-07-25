import { PageSection, PageSectionVariants, Text, TextContent } from '@patternfly/react-core'
import React from 'react'

export const Example1: React.FunctionComponent = () => (
  <PageSection variant={PageSectionVariants.light}>
    <TextContent>
      <Text component='h1'>Example 1</Text>
      <Text component='p'>
        This is an example plugin registered using <code>hawtio.addPlugin()</code> with wrong approach to
        synchronization.
      </Text>
    </TextContent>
  </PageSection>
)
