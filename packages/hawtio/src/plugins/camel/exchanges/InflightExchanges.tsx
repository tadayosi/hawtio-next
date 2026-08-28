import { CamelContext } from '@hawtiosrc/plugins/camel/context'
import { HawtioEmptyCard, HawtioLoadingCard } from '@hawtiosrc/plugins/shared'
import { Card, CardBody, CardTitle, Title } from '@patternfly/react-core'
import { Table, Tbody, Th, Td, Thead, Tr } from '@patternfly/react-table'
import React, { useContext, useEffect, useState } from 'react'
import * as exs from './exchanges-service'

export const InflightExchanges: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [isReading, setIsReading] = useState(false)
  const [canDisplayInflight, setCanDisplayInflight] = useState(false)
  const [exchanges, setExchanges] = useState<exs.Exchange[]>([])

  useEffect(() => {
    if (!selectedNode) {
      return
    }

    let timeoutHandle: NodeJS.Timeout
    const fetchExchanges = async () => {
      setIsReading(true)
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
    return <HawtioLoadingCard />
  }

  if (!canDisplayInflight) {
    return (
      <HawtioEmptyCard
        title='Inflight Exchanges'
        message='Browsing of Inflight Exchanges has not been enabled.'
        testid='exchanges-denied'
      />
    )
  }

  if (exchanges.length === 0) {
    return <HawtioEmptyCard title='Inflight Exchanges' message='No inflight exchanges found.' testid='no-exchanges' />
  }

  return (
    <Card isPlain>
      <CardTitle>
        <Title headingLevel='h3'> Inflight Exchanges</Title>
      </CardTitle>
      <CardBody>
        <Table data-testid='exchange-table' aria-label='Inflight Exchanges' variant='compact'>
          <Thead>
            <Tr>
              <Th modifier='wrap'>Exchange ID</Th>
              <Th modifier='wrap'>Route ID</Th>
              <Th modifier='wrap'>Node ID</Th>
              <Th modifier='wrap'>Duration (ms)</Th>
              <Th modifier='wrap'>Elapsed (ms)</Th>
            </Tr>
          </Thead>
          <Tbody>
            {exchanges.map(ex => (
              <Tr key={ex.exchangeId}>
                <Td>{ex.exchangeId}</Td>
                <Td>{ex.routeId}</Td>
                <Td>{ex.nodeId}</Td>
                <Td>{ex.duration}</Td>
                <Td>{ex.elapsed}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  )
}
