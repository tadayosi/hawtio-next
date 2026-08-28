import { AttributeValues, HawtioLoadingCard } from '@hawtiosrc/plugins/shared'
import { attributeService } from '@hawtiosrc/plugins/shared/attributes/attribute-service'
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  Icon,
  Stack,
  Switch,
} from '@patternfly/react-core'
import { CheckCircleIcon } from '@patternfly/react-icons/dist/esm/icons/check-circle-icon'
import { PauseCircleIcon } from '@patternfly/react-icons/dist/esm/icons/pause-circle-icon'
import Jolokia from 'jolokia.js'
import React, { useContext, useEffect, useState } from 'react'
import { QuartzContext } from '../context'
import { log } from '../globals'
import { QUARTZ_OPERATIONS, quartzService } from '../quartz-service'
import './Scheduler.css'

export const Scheduler: React.FunctionComponent = () => {
  const { selectedNode } = useContext(QuartzContext)
  const [attributes, setAttributes] = useState<AttributeValues>({})
  const [isReading, setIsReading] = useState(true)
  const [reload, setReload] = useState(false)

  useEffect(() => {
    if (!selectedNode || !selectedNode.objectName) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReading(true)
    const { objectName } = selectedNode
    attributeService.readWithCallback(objectName, attrs => {
      setAttributes(attrs)
      setIsReading(false)
    })

    attributeService.register({ type: 'read', mbean: objectName }, response => {
      if (Jolokia.isResponseFetchError(response)) {
        log.warn('Scheduler - Attributes (fetch error):', response)
        return
      }
      if (Jolokia.isError(response)) {
        log.warn('Scheduler - Attributes (Jolokia error):', response.error)
        return
      }
      log.debug('Scheduler - Attributes:', response.value)
      setAttributes(response.value as AttributeValues)
    })

    return () => attributeService.unregisterAll()
  }, [selectedNode])

  // When forcing reload
  useEffect(() => {
    if (!selectedNode || !selectedNode.objectName || !reload) {
      return
    }

    log.debug('Reload scheduler attributes')

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReading(true)
    const { objectName } = selectedNode
    attributeService.readWithCallback(objectName, attrs => {
      setAttributes(attrs)
      setIsReading(false)
    })

    setReload(false)
  }, [selectedNode, reload])

  if (!selectedNode || !selectedNode.objectName) {
    return null
  }

  if (isReading) {
    return <HawtioLoadingCard />
  }

  const { name, objectName } = selectedNode

  const canStartPauseScheduler = () => {
    return selectedNode.hasInvokeRights(QUARTZ_OPERATIONS.start, QUARTZ_OPERATIONS.standby)
  }

  const handleSchedulerSwitchChange = async (start: boolean) => {
    await (start ? quartzService.start(name, objectName) : quartzService.pause(name, objectName))
    setReload(true)
  }

  const canUpdateSampleStatisticsEnabled = () => {
    // TODO: currently using the same criteria as start/pause scheduler, as it requires writing to an attribute
    return selectedNode.hasInvokeRights(QUARTZ_OPERATIONS.start, QUARTZ_OPERATIONS.standby)
  }

  const handleSampledStatisticsSwitchChange = async (value: boolean) => {
    await quartzService.updateSampleStatisticsEnabled(name, objectName, value)
    setReload(true)
  }

  const scheduler = {
    // scheduler
    started: attributes['Started'] as boolean,
    name: attributes['SchedulerName'] as string,
    instance: attributes['SchedulerInstanceId'] as string,
    version: attributes['Version'] as string,
    jobStoreClassName: attributes['JobStoreClassName'] as string,
    threadPoolClassName: attributes['ThreadPoolClassName'] as string,
    threadPoolSize: attributes['ThreadPoolSize'] as number,
    // sampled statistics
    sampledStatisticsEnabled: attributes['SampledStatisticsEnabled'] as boolean,
    jobsCompleted: attributes['JobsCompletedMostRecentSample'] as number,
    jobsExecuted: attributes['JobsExecutedMostRecentSample'] as number,
    jobsScheduled: attributes['JobsScheduledMostRecentSample'] as number,
  }

  return (
    <Stack id='quartz-scheduler' hasGutter>
      <Card id='quartz-scheduler-main' isPlain>
        <CardHeader
          actions={{
            actions: (
              <Switch
                id='quartz-scheduler-main-switch'
                label='Started'
                isChecked={scheduler.started}
                isDisabled={!canStartPauseScheduler()}
                onChange={(_event, start) => handleSchedulerSwitchChange(start)}
                isReversed
              />
            ),
            hasNoOffset: false,
          }}
        >
          <CardTitle>
            {scheduler.started ? (
              <Icon status='success'>
                <CheckCircleIcon />
              </Icon>
            ) : (
              <Icon>
                <PauseCircleIcon />
              </Icon>
            )}
            Scheduler
          </CardTitle>
        </CardHeader>
        <CardBody>
          <DescriptionList isCompact isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>Name</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.name}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Instance</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.instance}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Version</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.version}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Job store class name</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.jobStoreClassName}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Thread pool class name</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.threadPoolClassName}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Thread pool size</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.threadPoolSize}</DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </CardBody>
      </Card>
      <Divider />
      <Card id='quartz-scheduler-statistics' isPlain>
        <CardHeader
          actions={{
            actions: (
              <Switch
                id='quartz-scheduler-statistics-switch'
                label='Enabled'
                isChecked={scheduler.sampledStatisticsEnabled}
                isDisabled={!canUpdateSampleStatisticsEnabled()}
                onChange={(_event, value) => handleSampledStatisticsSwitchChange(value)}
                isReversed
              />
            ),
            hasNoOffset: false,
            className: undefined,
          }}
        >
          <CardTitle>
            {scheduler.sampledStatisticsEnabled ? (
              <Icon status='success'>
                <CheckCircleIcon />
              </Icon>
            ) : (
              <Icon>
                <PauseCircleIcon />
              </Icon>
            )}
            Sampled Statistics (Most Recent Samples)
          </CardTitle>
        </CardHeader>
        <CardBody>
          <DescriptionList isCompact isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>Jobs completed</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.jobsCompleted}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Jobs executed</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.jobsExecuted}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Jobs scheduled</DescriptionListTerm>
              <DescriptionListDescription>{scheduler.jobsScheduled}</DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </CardBody>
      </Card>
    </Stack>
  )
}
