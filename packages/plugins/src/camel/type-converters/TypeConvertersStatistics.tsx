import React, { useContext, useEffect, useState } from 'react'
import {
  Button,
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
  Text,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core'
import { RedoIcon, TrendUpIcon } from '@patternfly/react-icons'
import { CamelContext } from '__root__/camel/context'
import { MBeanNode } from '__root__/shared/tree'
import { eventService } from '@hawtio/react/core'
import * as tcs from './type-converters-service'

const enableButtonLabelValue = 'Enable Statistics'
const disableButtonLabelValue = 'Disable Statistics'

export const TypeConvertersStatistics: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [isReading, setIsReading] = useState(true)
  const [statistics, setStatistics] = useState<tcs.TypeConvertersStats>(new tcs.TypeConvertersStats())
  const [statisticsEnabled, setStatisticsEnabled] = useState(false)

  const onModeStatisticsClicked = () => {
    tcs.setStatisticsEnablement(selectedNode as MBeanNode, !statisticsEnabled).then(_ => {
      setStatisticsEnabled(!statisticsEnabled)
    })
  }

  const onResetStatisticsClicked = () => {
    setStatistics(new tcs.TypeConvertersStats())
    tcs.resetStatistics(selectedNode as MBeanNode)
  }

  const modeStatisticsValue = (value: number): string => {
    return statisticsEnabled ? `${value}` : '-'
  }

  /**
   * Runs on load to determine if statistics are enabled
   * and set the flag accordingly
   */
  useEffect(() => {
    setIsReading(true)

    const checkEnabled = async () => {
      const enabled = await tcs.getStatisticsEnablement(selectedNode)
      setStatisticsEnabled(enabled)
      setIsReading(false)
    }

    checkEnabled()
  }, [selectedNode])

  /**
   * Executes on change of statisticsEnabled flag in that
   * statistics are only fetched when that flag is true
   * Importantly, the timeout is not executed in the background
   * if statistic collection is disabled
   */
  useEffect(() => {
    if (!statisticsEnabled) return

    let timeoutHandle: NodeJS.Timeout
    const readStats = async () => {
      try {
        if (statisticsEnabled) {
          const stats = await tcs.getStatistics(selectedNode)
          setStatistics(stats)
        }

        timeoutHandle = setTimeout(readStats, 10000)
      } catch (error) {
        eventService.notify({
          type: 'warning',
          message: error as string,
        })
      }
    }
    readStats()

    return () => {
      clearTimeout(timeoutHandle)
    }
  }, [selectedNode, statisticsEnabled])

  if (!selectedNode) {
    return (
      <React.Fragment>
        <Text data-testid='no-stats-available' component='p'>
          No statistics available.
        </Text>
      </React.Fragment>
    )
  }

  if (isReading) {
    return (
      <React.Fragment>
        <Text data-testid='loading' component='p'>
          Loading ...
        </Text>
      </React.Fragment>
    )
  }

  return (
    <React.Fragment>
      <Toolbar data-testid='stats-view-toolbar' id='toolbar-items'>
        <ToolbarContent>
          <ToolbarItem>
            <Button
              variant='secondary'
              isSmall={true}
              icon={React.createElement(TrendUpIcon)}
              onClick={onModeStatisticsClicked}
            >
              {statisticsEnabled ? disableButtonLabelValue : enableButtonLabelValue}
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button
              variant='secondary'
              isSmall={true}
              isDisabled={!statisticsEnabled}
              icon={React.createElement(RedoIcon)}
              onClick={onResetStatisticsClicked}
            >
              Reset Statistics
            </Button>
          </ToolbarItem>
          <ToolbarItem variant='separator' />
        </ToolbarContent>
      </Toolbar>
      <DescriptionList
        isHorizontal
        isCompact
        className='camel-type-converters-statistics'
        data-testid='stats-view-list'
      >
        <DescriptionListGroup>
          <DescriptionListTerm>Attempts</DescriptionListTerm>
          <DescriptionListDescription data-testid='attemptCounter'>
            {modeStatisticsValue(statistics.attemptCounter)}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Hits</DescriptionListTerm>
          <DescriptionListDescription data-testid='hitCounter'>
            {modeStatisticsValue(statistics.hitCounter)}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Misses</DescriptionListTerm>
          <DescriptionListDescription data-testid='missesCounter'>
            {modeStatisticsValue(statistics.missCounter)}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Failures</DescriptionListTerm>
          <DescriptionListDescription data-testid='failedCounter'>
            {modeStatisticsValue(statistics.failedCounter)}
          </DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>
    </React.Fragment>
  )
}
