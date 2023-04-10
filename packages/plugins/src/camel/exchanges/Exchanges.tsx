import { Card, CardTitle } from '@patternfly/react-core'
import React from 'react'
import { BlockedExchanges } from './BlockedExchanges'
import { InflightExchanges } from './InflightExchanges'

export const Exchanges: React.FunctionComponent = () => {
  return (
    <React.Fragment>
      <Card isFullHeight>
        <CardTitle>Inflight Exchanges</CardTitle>
        <InflightExchanges></InflightExchanges>
      </Card>
      <Card isFullHeight>
        <CardTitle>Blocked Exchanges</CardTitle>
        <BlockedExchanges></BlockedExchanges>
      </Card>
    </React.Fragment>
  )
}
