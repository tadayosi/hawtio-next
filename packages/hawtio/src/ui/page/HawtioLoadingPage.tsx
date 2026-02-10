import { Bullseye, Content, Page, PageSection, Spinner } from '@patternfly/react-core'
import React from 'react'
import './HawtioLoadingPage.css'

export const HawtioLoadingPage: React.FunctionComponent = () => (
  <Page id='hawtio-loading-page' mainContainerId='hawtio-loading-container' sidebar={null}>
    <PageSection isFilled isWidthLimited isCenterAligned hasBodyWrapper={false}>
      <Bullseye>
        <Spinner diameter='60px' aria-label='Loading Hawtio' />
        <Content component='h3' style={{ marginLeft: '1rem' }}>
          Loading ...
        </Content>
      </Bullseye>
    </PageSection>
  </Page>
)
