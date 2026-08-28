import { HawtioEmptyCard, HawtioLoadingCard } from '@hawtiosrc/plugins/shared'
import { Panel, PanelHeader, PanelMain, PanelMainBody, Title } from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import Jolokia, { JolokiaSuccessResponse, JolokiaErrorResponse, JolokiaFetchErrorResponse } from 'jolokia.js'
import React, { useContext, useEffect, useState } from 'react'
import { CamelContext } from '../context'
import { log } from '../globals'
import { ProfileData, profileService } from './profile-service'

export const Profile: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [isReading, setIsReading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileData[]>([])

  useEffect(() => {
    if (!selectedNode) return

    const profile = async () => {
      setIsReading(true)
      setProfileData(await profileService.getProfile(selectedNode))
      setIsReading(false)
    }

    profile()

    /*
     * Sets up polling and live updating of tracing
     */
    profileService.register(
      {
        type: 'exec',
        mbean: selectedNode.objectName as string,
        operation: 'dumpRouteStatsAsXml()',
      },
      (response: JolokiaSuccessResponse | JolokiaErrorResponse | JolokiaFetchErrorResponse) => {
        if (Jolokia.isResponseFetchError(response)) {
          log.warn('Scheduler - Profile (fetch error):', response)
          return
        }
        if (Jolokia.isError(response)) {
          log.warn('Scheduler - Profile (Jolokia error):', response.error)
          return
        }
        log.debug('Scheduler - Profile:', response.value)
        profile()
      },
    )

    // Unregister old handles
    return () => profileService.unregisterAll()
  }, [selectedNode])

  if (!selectedNode) {
    return <HawtioEmptyCard message='No selection has been made.' />
  }

  if (isReading) {
    return <HawtioLoadingCard />
  }

  return (
    <Panel>
      <PanelHeader>
        <Title headingLevel='h3'>Profiling</Title>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          <Table aria-label='message table' variant='compact' isStriped>
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Count</Th>
                <Th>Last</Th>
                <Th>Delta</Th>
                <Th>Mean</Th>
                <Th>Min</Th>
                <Th>Max</Th>
                <Th>Total</Th>
                <Th>Self</Th>
              </Tr>
            </Thead>
            <Tbody isOddStriped>
              {profileData.map(pd => (
                <Tr key={pd.id}>
                  <Td dataLabel='ID'>{pd.id}</Td>
                  <Td dataLabel='Count'>{pd.count}</Td>
                  <Td dataLabel='Last'>{pd.last}</Td>
                  <Td dataLabel='Delta'>{pd.delta}</Td>
                  <Td dataLabel='Mean'>{pd.mean}</Td>
                  <Td dataLabel='Min'>{pd.min}</Td>
                  <Td dataLabel='Max'>{pd.max}</Td>
                  <Td dataLabel='Total'>{pd.total}</Td>
                  <Td dataLabel='Self'>{pd.self}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
