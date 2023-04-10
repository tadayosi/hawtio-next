import React, { useEffect, useState, useContext } from 'react'
import { CardBody, Text } from '@patternfly/react-core'
import { Table, TableBody, TableHeader, TableProps, wrappable } from '@patternfly/react-table'
import { CamelContext } from '__root__/camel/context'
import * as exs from './exchanges-service'

export const InflightExchanges: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [isReading, setIsReading] = useState(false)
  const [canDisplayInflight, setCanDisplayInflight] = useState(false)
  const emptyExchgs: exs.Exchange[] = []
  const [exchanges, setExchanges] = useState(emptyExchgs)

  useEffect(() => {
    if (!selectedNode) {
      return
    }

    setIsReading(true)

    let timeoutHandle: NodeJS.Timeout
    const fetchExchanges = async () => {
      const cb = await exs.canBrowseInflightExchanges(selectedNode)
      setCanDisplayInflight(cb)
      if (cb) setExchanges(await exs.getInflightExchanges(selectedNode))

      setIsReading(false)

      timeoutHandle = setTimeout(fetchExchanges, 10000)
    }

    fetchExchanges()

    return () => {
      clearTimeout(timeoutHandle)
    }
  }, [selectedNode])

  if (isReading) {
    return (
      <CardBody>
        <Text data-testid='loading' component='p'>
          Loading...
        </Text>
      </CardBody>
    )
  }

  if (!canDisplayInflight) {
    return (
      <CardBody>
        <Text data-testid='exchanges-denied' component='p'>
          Browsing of Inflight Exchanges has not been enabled.
        </Text>
      </CardBody>
    )
  }

  if (exchanges.length === 0) {
    return (
      <CardBody>
        <Text data-testid='no-exchanges' component='p'>
          No inflight exchanges
        </Text>
      </CardBody>
    )
  }

  const columns: TableProps['cells'] = []
  columns.push({ title: 'Exchange ID', transforms: [wrappable] })
  columns.push({ title: 'Route ID', transforms: [wrappable] })
  columns.push({ title: 'Node ID', transforms: [wrappable] })
  columns.push({ title: 'Duration (ms)', transforms: [wrappable] })
  columns.push({ title: 'Elapsed (ms)', transforms: [wrappable] })

  const rows: TableProps['rows'] = exchanges.map(ex => [ex.exchangeId, ex.routeId, ex.nodeId, ex.duration, ex.elapsed])

  return (
    <CardBody>
      <Table data-testid='exchange-table' aria-label='Inflight Exchanges' cells={columns} rows={rows}>
        <TableHeader />
        <TableBody />
      </Table>
    </CardBody>
  )
}
