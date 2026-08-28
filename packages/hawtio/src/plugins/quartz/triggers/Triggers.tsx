import { HawtioLoadingCard } from '@hawtiosrc/plugins/shared'
import { FilteredTable } from '@hawtiosrc/ui'
import { Button, Icon } from '@patternfly/react-core'
import { CheckCircleIcon } from '@patternfly/react-icons/dist/esm/icons/check-circle-icon'
import { PauseCircleIcon } from '@patternfly/react-icons/dist/esm/icons/pause-circle-icon'
import { ActionsColumn } from '@patternfly/react-table'
import React, { useContext, useEffect, useState } from 'react'
import { QuartzContext } from '../context'
import { log } from '../globals'
import {
  QUARTZ_FACADE_OPERATIONS,
  QUARTZ_OPERATIONS,
  Trigger,
  misfireInstructions,
  quartzService,
} from '../quartz-service'
import { TriggersManualModal } from './TriggersManualModal'
import { TriggersUpdateModal } from './TriggersUpdateModal'

export const Triggers: React.FunctionComponent = () => {
  const { selectedNode } = useContext(QuartzContext)
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [isReading, setIsReading] = useState(true)
  const [reload, setReload] = useState(false)
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [isManualOpen, setIsManualOpen] = useState(false)

  useEffect(() => {
    if (!selectedNode || !selectedNode.objectName) {
      return
    }

    const { objectName } = selectedNode
    const loadTriggers = async () => {
      setIsReading(true)
      const triggers = await quartzService.loadTriggers(objectName)
      setTriggers(triggers)
      setIsReading(false)
    }
    loadTriggers()

    // Watch triggers update
    quartzService.registerTriggersLoad(objectName, triggers => {
      setTriggers(triggers)
    })

    return () => quartzService.unregisterAll()
  }, [selectedNode])

  // When forcing reload
  useEffect(() => {
    if (!selectedNode || !selectedNode.objectName || !reload) {
      return
    }

    log.debug('Reload triggers')

    const { objectName } = selectedNode
    const loadTriggers = async () => {
      const triggers = await quartzService.loadTriggers(objectName)
      setTriggers(triggers)
      setReload(false)
    }
    loadTriggers()
  }, [selectedNode, reload])

  if (!selectedNode || !selectedNode.objectName) {
    return null
  }

  if (isReading) {
    return <HawtioLoadingCard />
  }

  const triggerStates = ['NORMAL', 'PAUSED']

  const { objectName } = selectedNode

  const triggerReload = () => setReload(true)

  const canUpdateTrigger = () => {
    return selectedNode.hasInvokeRights(
      QUARTZ_FACADE_OPERATIONS.updateCronTrigger,
      QUARTZ_FACADE_OPERATIONS.updateSimpleTrigger,
    )
  }

  const handleUpdateToggle = () => {
    setIsUpdateOpen(!isUpdateOpen)
  }

  const canTriggerJob = () => {
    return selectedNode.hasInvokeRights(QUARTZ_OPERATIONS.triggerJob)
  }

  const handleManualToggle = () => {
    setIsManualOpen(!isManualOpen)
  }

  const canPauseTrigger = () => {
    return selectedNode.hasInvokeRights(QUARTZ_OPERATIONS.pauseTrigger)
  }

  const pauseTrigger = async (trigger: Trigger) => {
    await quartzService.pauseTrigger(objectName, trigger.name, trigger.group)
    triggerReload()
  }

  const canResumeTrigger = () => {
    return selectedNode.hasInvokeRights(QUARTZ_OPERATIONS.resumeTrigger)
  }

  const resumeTrigger = async (trigger: Trigger) => {
    await quartzService.resumeTrigger(objectName, trigger.name, trigger.group)
    triggerReload()
  }

  const toMisfireText = (misfireInstruction: number): string => {
    return misfireInstructions.find(({ value }) => misfireInstruction === value)?.label ?? 'Unknown'
  }

  return (
    <FilteredTable
      rows={triggers}
      highlightSearch={true}
      tableColumns={[
        {
          name: 'State',
          key: 'state',
          percentageWidth: 10,
          renderer: ({ state }) =>
            state?.toLowerCase() === 'normal' ? (
              <Icon status='success'>
                <CheckCircleIcon />
              </Icon>
            ) : (
              <Icon>
                <PauseCircleIcon />
              </Icon>
            ),
        },
        {
          name: 'Group',
          key: 'group',
          percentageWidth: 10,
        },
        {
          name: 'Name',
          key: 'name',
          percentageWidth: 10,
        },
        {
          name: 'Type',
          key: 'type',
          percentageWidth: 10,
        },
        {
          name: 'Expression',
          key: 'expression',
          percentageWidth: 20,
        },
        {
          name: 'Misfire Instruction',
          key: 'misfireInstruction',
          percentageWidth: 15,
          renderer: ({ misfireInstruction }) => toMisfireText(misfireInstruction),
        },
        {
          name: 'Previous Execution',
          key: 'previousFireTime',
          percentageWidth: 15,
        },
        {
          name: 'Next Execution',
          key: 'nextFireTime',
          percentageWidth: 15,
        },
        {
          name: 'Final execution',
          key: 'finalFireTime',
          percentageWidth: 10,
          hideValues: ['null'],
        },
        {
          name: 'Action',
          percentageWidth: 10,
          renderer: row =>
            row.state?.toLowerCase() === 'normal' ? (
              <Button variant='danger' size='sm' onClick={() => pauseTrigger(row)} isDisabled={!canPauseTrigger()}>
                Pause
              </Button>
            ) : (
              <Button variant='primary' size='sm' onClick={() => resumeTrigger(row)} isDisabled={!canResumeTrigger()}>
                Resume
              </Button>
            ),
        },
        {
          isAction: true,
          percentageWidth: 10,
          renderer: row => (
            <>
              <ActionsColumn
                items={[
                  {
                    title: 'Update Trigger',
                    isDisabled: !canUpdateTrigger(),
                    onClick: handleUpdateToggle,
                  },
                  {
                    title: 'Trigger Manually',
                    isDisabled: !canTriggerJob(),
                    onClick: handleManualToggle,
                  },
                ]}
              />
              <TriggersUpdateModal
                isOpen={isUpdateOpen}
                onClose={handleUpdateToggle}
                input={row}
                reload={triggerReload}
              />
              <TriggersManualModal isOpen={isManualOpen} onClose={handleManualToggle} input={row} />
            </>
          ),
        },
      ]}
      fixedSearchCategories={[
        {
          name: 'State',
          key: 'state',
          values: triggerStates,
        },
      ]}
      searchCategories={[
        {
          name: 'Group',
          key: 'group',
        },
        {
          name: 'Name',
          key: 'name',
        },
        {
          name: 'Type',
          key: 'type',
        },
      ]}
    />
  )
}
