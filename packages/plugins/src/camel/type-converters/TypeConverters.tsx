import React from 'react'
import { Card, CardTitle, CardBody } from '@patternfly/react-core'
import { TypeConvertersStatistics } from './TypeConvertersStatistics'
import './TypeConverters.css'

export const TypeConverters: React.FunctionComponent = () => {
  return (
    <Card isFullHeight>
      <CardTitle>Type Converters</CardTitle>
      <CardBody>
        <TypeConvertersStatistics></TypeConvertersStatistics>
      </CardBody>
    </Card>
  )
}
