import { Button, CodeBlock, CodeBlockCode, Content, PageSection } from '@patternfly/react-core'
import React from 'react'

export const Example1: React.FunctionComponent = () => (
  <PageSection hasBodyWrapper={false}>
    <Content>
      <Content component='h1'>Example 1</Content>
      <Content component='p'>
        This is an example plugin registered using <code>hawtio.addDeferredPlugin()</code>.
      </Content>
      <Content component='p'>
        This plugin doesn't import <code>./Example1</code> file using <em>static</em> <code>import</code> statement, but
        with <em>dynamic</em> <code>import()</code> operator.
      </Content>
      <Content component='p'>Here's the preferred, asynchronous, Hawtio plugin registration code:</Content>
      <CodeBlock>
        <CodeBlockCode>
          {`import { hawtio, type HawtioPlugin } from '@hawtio/react'

export const registerExample1Deferred: HawtioPlugin = () => {
  hawtio.addDeferredPlugin('example1b', async () => {
    return import('./Example1').then(m => {
      return {
        id: 'example1b',
        title: 'Example 1 (deferred)',
        path: '/example1b',
        component: m.Example1,
        isActive: async () => true,
      }
    })
  })
}`}
        </CodeBlockCode>
      </CodeBlock>
    </Content>
  </PageSection>
)

/**
 * Dummy extension button registered into the 'jmx-attributes-toolbar' slot.
 * In a real plugin this would be replaced with a meaningful action component.
 */
export const Example1ExtensionButton: React.FunctionComponent = () => (
  <Button variant='secondary' size='sm' onClick={() => alert('Extension button clicked!')}>
    Example Extension
  </Button>
)
