import { HawtioLoadingCard } from '@hawtiosrc/plugins/shared'
import { Button } from '@patternfly/react-core'
import { Modal } from '@patternfly/react-core/deprecated'
import './Jobs.css'

import { FilteredTable } from '@hawtiosrc/ui'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import React, { useContext, useEffect, useState } from 'react'
import { QuartzContext } from '../context'
import { Job, quartzService } from '../quartz-service'

export const Jobs: React.FunctionComponent = () => {
  const { selectedNode } = useContext(QuartzContext)
  const [jobs, setJobs] = useState<Job[]>([])
  const [isReading, setIsReading] = useState(true)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  useEffect(() => {
    if (!selectedNode || !selectedNode.mbean || !selectedNode.objectName) {
      return
    }

    const { objectName } = selectedNode
    const loadJobs = async () => {
      setIsReading(true)
      const jobs = await quartzService.loadJobs(objectName)
      setJobs(jobs)
      setIsReading(false)
    }
    loadJobs()

    quartzService.registerJobsLoad(objectName, jobs => {
      setJobs(jobs)
    })

    return () => quartzService.unregisterAll()
  }, [selectedNode])

  if (!selectedNode || !selectedNode.mbean || !selectedNode.objectName) {
    return null
  }

  if (isReading) {
    return <HawtioLoadingCard />
  }

  return (
    <React.Fragment>
      <FilteredTable
        classPrefix='quartz-jobs'
        rows={jobs}
        highlightSearch={true}
        tableColumns={[
          {
            name: 'Group',
            key: 'group',
            percentageWidth: 20,
          },
          {
            name: 'Name',
            key: 'name',
            percentageWidth: 10,
          },
          {
            name: 'Durable',
            key: 'durability',
            percentageWidth: 10,
          },
          {
            name: 'Recover',
            key: 'shouldRecover',
            percentageWidth: 10,
          },
          {
            name: 'Job Class Name',
            key: 'jobClass',
            percentageWidth: 20,
          },
          {
            name: 'Description',
            key: 'description',
            percentageWidth: 20,
            hideValues: ['null'],
          },
        ]}
        fixedSearchCategories={[
          {
            name: 'Durable',
            key: 'durability',
            values: ['true', 'false'],
          },
          {
            name: 'Recover',
            key: 'shouldRecover',
            values: ['true', 'false'],
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
            name: 'Job Class',
            key: 'jobClass',
          },
          {
            name: 'Description',
            key: 'description',
          },
        ]}
        onClick={row => {
          setSelectedJob(row)
          setIsDetailOpen(true)
        }}
      />
      <JobDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedJob(null)
        }}
        input={selectedJob}
      />
    </React.Fragment>
  )
}

const JobDetailModal: React.FunctionComponent<{
  isOpen: boolean
  onClose: () => void
  input: Job | null
}> = ({ isOpen, onClose, input }) => {
  if (!input) {
    return null
  }

  const { group, name, jobDataMap } = input

  return (
    <Modal
      id='quartz-jobs-detail-modal'
      variant='medium'
      title={`Job Detail: ${group}/${name}`}
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button key='close' variant='primary' onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <Table id='quartz-jobs-detail-table' variant='compact' aria-label='Job Detail Table' isStriped>
        <Thead>
          <Tr>
            <Th>Key</Th>
            <Th>Value</Th>
          </Tr>
        </Thead>
        <Tbody>
          {Object.entries(jobDataMap).map(([key, value], index) => (
            <Tr key={index}>
              <Td>{key}</Td>
              <Td>{value}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Modal>
  )
}
