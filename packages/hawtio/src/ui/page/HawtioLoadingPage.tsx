import { Bullseye, Content, Page, PageSection, Spinner } from '@patternfly/react-core'
import React from 'react'
import './HawtioLoadingPage.css'

export const HawtioLoadingPage: React.FunctionComponent = () => (
  <Page
    id='hawtio-loading-page'
    mainContainerId='hawtio-loading-container'
    sidebar={null}
  >
    <PageSection isFilled={true} className='hwt-loading-page-section'>
      <Bullseye>
        <Spinner diameter='60px' aria-label='Loading Hawtio' />
        <Content component='h3'>
          Loading ...
        </Content>
      </Bullseye>
    </PageSection>
  </Page>
)
