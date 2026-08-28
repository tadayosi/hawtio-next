import { FilteredTable } from '@hawtiosrc/ui'
import { Button, CodeBlock, CodeBlockCode, ToolbarGroup, ToolbarItem } from '@patternfly/react-core'
import { Modal } from '@patternfly/react-core/deprecated'
import React, { useEffect, useState } from 'react'
import { runtimeService } from './runtime-service'
import { ThreadInfoModal } from './ThreadInfoModal'
import { Thread } from './types'

const ThreadsDumpModal: React.FunctionComponent<{
  isOpen: boolean
  setIsOpen: (opened: boolean) => void
}> = ({ isOpen, setIsOpen }) => {
  const [threadsDump, setThreadsDump] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const readThreadDump = async () => {
      const threadsDump = await runtimeService.dumpThreads()
      setThreadsDump(threadsDump)
    }
    readThreadDump()
  }, [isOpen])

  return (
    <Modal
      bodyAriaLabel='Thread Dump'
      tabIndex={0}
      isOpen={isOpen}
      variant='large'
      title='Thread Dump'
      onClose={() => setIsOpen(false)}
    >
      <CodeBlock>
        <CodeBlockCode>{threadsDump}</CodeBlockCode>
      </CodeBlock>
    </Modal>
  )
}

const ExtraToolBar: React.FunctionComponent<{
  handleConnectionThreadMonitoring: () => void
  threadConnectionMonitoring: boolean
  onThreadDumpClick: () => void
}> = ({ handleConnectionThreadMonitoring, threadConnectionMonitoring, onThreadDumpClick }) => (
  <ToolbarGroup>
    <ToolbarItem>
      <Button variant='primary' onClick={handleConnectionThreadMonitoring} size='sm'>
        {threadConnectionMonitoring ? 'Disable' : 'Enable'} connection thread monitoring
      </Button>
    </ToolbarItem>
    <ToolbarItem>
      <Button variant='secondary' onClick={onThreadDumpClick} size='sm'>
        Thread dump
      </Button>
    </ToolbarItem>
  </ToolbarGroup>
)

export const Threads: React.FunctionComponent = () => {
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentThread, setCurrentThread] = useState<Thread | undefined>()
  const [isThreadsDumpModalOpen, setIsThreadsDumpModalOpen] = useState(false)
  const [isThreadDetailsOpen, setIsThreadDetailsOpen] = useState(false)
  const [threadConnectionMonitoring, setThreadConnectionMonitoring] = useState(false)

  useEffect(() => {
    const readThreads = async () => {
      const threads = await runtimeService.loadThreads()
      setThreads(threads)
      setThreadConnectionMonitoring(await runtimeService.isThreadContentionMonitoringEnabled())
      runtimeService.registerLoadThreadsRequest(newThreads => {
        setThreads(newThreads)
      })
    }
    readThreads()
    return () => runtimeService.unregisterAll()
  }, [])

  const onThreadDumpClick = () => {
    setIsThreadsDumpModalOpen(true)
  }

  const handleConnectionThreadMonitoring = async () => {
    await runtimeService.enableThreadContentionMonitoring(!threadConnectionMonitoring)
    setThreadConnectionMonitoring(!threadConnectionMonitoring)
  }

  const DetailsButton = (thread: Thread) => (
    <Button
      onClick={_event => {
        setIsThreadDetailsOpen(true)
        setCurrentThread(thread)
      }}
      size='sm'
      variant='link'
    >
      Details
    </Button>
  )

  return (
    <React.Fragment>
      <ThreadsDumpModal isOpen={isThreadsDumpModalOpen} setIsOpen={setIsThreadsDumpModalOpen} />
      <ThreadInfoModal isOpen={isThreadDetailsOpen} thread={currentThread} setIsOpen={setIsThreadDetailsOpen} />

      <FilteredTable
        tableColumns={[
          { key: 'threadId', name: 'ID', percentageWidth: 10 },
          { key: 'threadState', name: 'State', percentageWidth: 10 },
          { key: 'threadName', name: 'Name', percentageWidth: 30 },
          { key: 'waitedTime', name: 'Waited Time', percentageWidth: 10 },
          { key: 'blockedTime', name: 'Blocked Time', percentageWidth: 10 },
          { key: 'inNative', name: 'Native', percentageWidth: 10 },
          { key: 'suspended', name: 'Suspended', percentageWidth: 10 },
          { renderer: DetailsButton, percentageWidth: 10 },
        ]}
        searchCategories={[
          {
            name: 'Name',
            key: 'threadName',
          },
          {
            name: 'State',
            key: 'threadState',
          },
        ]}
        rows={threads}
        extraToolbarRight={
          <ExtraToolBar
            handleConnectionThreadMonitoring={handleConnectionThreadMonitoring}
            onThreadDumpClick={onThreadDumpClick}
            threadConnectionMonitoring={threadConnectionMonitoring}
          />
        }
      />
    </React.Fragment>
  )
}
