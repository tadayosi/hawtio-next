import { NotificationType, eventService } from '@hawtiosrc/core'
import {
  Bullseye,
  Button,
  CodeBlock,
  CodeBlockCode,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  FormGroup,
  Pagination,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  SearchInput,
  TextInput,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core'
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated'
import { SearchIcon } from '@patternfly/react-icons/dist/esm/icons/search-icon'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import React, { useContext, useEffect, useState } from 'react'
import { Position } from 'reactflow'
import { CamelContext } from '../context'
import { InputWithSuggestions } from './InputWithSuggestions'
import { MessageData, forwardMessagesToEndpoint, getEndpoints, getMessagesFromTheEndpoint } from './endpoints-service'

export const BrowseMessages: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [messages, setMessages] = useState<MessageData[]>([])
  const [filteredMessages, setFilteredMessages] = useState<MessageData[]>([])
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filters, setFilters] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [endpoints, setEndpoints] = useState<string[]>([])

  const updateMessages = (messages: MessageData[]) => {
    const data = messages.reverse()
    setMessages(data)
    setFilteredMessages(data)
    setSelected([])
    setFilters([])
  }

  useEffect(() => {
    if (!selectedNode) {
      return
    }
    const initLoad = async () => {
      const messages = await getMessagesFromTheEndpoint(selectedNode, 0, -1)
      updateMessages(messages)
      const endps = await getEndpoints(selectedNode)
      setEndpoints(endps.map(v => v.uri))
    }
    initLoad()
  }, [selectedNode])

  if (!selectedNode) {
    return null
  }

  const loadMessages = async () => {
    const messages = await getMessagesFromTheEndpoint(selectedNode, 0, -1)
    updateMessages(messages)
  }

  const handleSearch = (value: string, filters: string[]) => {
    setSearchTerm(value)
    // filter with findTerm
    let filtered: MessageData[] = []
    if (value === '') {
      filtered = [...messages]
    } else {
      filtered = messages.filter(
        message => message.messageId.toLowerCase().includes(value.toLowerCase()) || message.body.includes(value),
      )
    }

    // filter with the rest of the filters
    filters.forEach(value => {
      filtered = filtered.filter(
        message => message.messageId.toLowerCase().includes(value.toLowerCase()) || message.body.includes(value),
      )
    })
    setSearchTerm(value)
    setPage(1)
    setFilteredMessages([...filtered])
  }

  const addToFilters = () => {
    setFilters([...filters, searchTerm])
    setSearchTerm('')
  }

  const getFromIndex = (): number => {
    return (page - 1) * perPage
  }

  const getToIndex = (): number => {
    return getFromIndex() + perPage
  }

  const getPage = () => {
    return filteredMessages.slice(getFromIndex(), getToIndex())
  }

  const handleNextMessage = (index: number): MessageData | null => {
    return filteredMessages[index] ?? null
  }

  const getSubstring = (body: string): string => {
    let res = body.substring(0, 100)
    if (body.length > 100) {
      res += '...'
    }
    return res
  }

  const onSelect = (messageId: string, isSelecting: boolean) => {
    const selectedRoutes = selected.filter(m => messageId !== m)
    setSelected(isSelecting ? [...selectedRoutes, messageId] : [...selectedRoutes])
  }

  const onSelectAll = (isSelected: boolean) => {
    const selected = filteredMessages.map(m => m.messageId)
    setSelected(isSelected ? selected : [])
  }

  const clearFilters = () => {
    setFilters([])
    setSearchTerm('')
    setFilteredMessages([...messages])
  }

  const onDeleteFilter = (filter: string) => {
    const newFilters = filters.filter(f => f !== filter)
    setFilters(newFilters)
    handleSearch(searchTerm, newFilters)
  }

  const isAllSelected = (): boolean => {
    //  let res = true
    for (const m of filteredMessages) {
      if (!selected.includes(m.messageId)) {
        return false
      }
    }
    return true
  }

  const createNotification = (type: NotificationType, message: string) => {
    eventService.notify({
      type: type,
      message: message,
    })
  }

  const forwardMessages = async (uri: string, message?: MessageData) => {
    if (selectedNode) {
      let selectedMessages: MessageData[] = []
      if (message) {
        selectedMessages.push(message)
      } else {
        selectedMessages = messages.filter(m => selected.includes(m.messageId))
      }
      await forwardMessagesToEndpoint(selectedNode, uri, selectedMessages, createNotification)
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <Title headingLevel='h3'>Browse Messages</Title>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          <Toolbar clearAllFilters={clearFilters}>
            <ToolbarContent>
              <ToolbarGroup>
                <ToolbarFilter
                  labels={filters}
                  deleteLabel={(_e, filter) => onDeleteFilter(filter as string)}
                  deleteLabelGroup={clearFilters}
                  categoryName='Filters'
                >
                  <SearchInput
                    type='text'
                    data-testid='filter-input'
                    id='search-input'
                    placeholder='Search...'
                    value={searchTerm}
                    onChange={(_event, value) => handleSearch(value, filters)}
                    aria-label='Search input'
                  />
                </ToolbarFilter>
                <Button variant='secondary' onClick={addToFilters}>
                  Add Filter
                </Button>
              </ToolbarGroup>
              <ToolbarItem>
                <Button variant='secondary' onClick={loadMessages}>
                  Refresh
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <ForwardMessagesModal
                  endpoints={endpoints}
                  enabled={selected.length > 0}
                  onForwardMessages={forwardMessages}
                />
              </ToolbarItem>
              <ToolbarItem variant='pagination'>
                <MessagesPagination
                  page={page}
                  perPage={perPage}
                  setPage={setPage}
                  setPerPage={setPerPage}
                  filteredMessages={filteredMessages}
                />
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>

          {filteredMessages.length > 0 && (
            <FormGroup>
              <Table aria-label='Message Table' variant='compact' height='80vh'>
                <Thead>
                  <Tr>
                    <Th
                      aria-label='select-message-header'
                      select={{
                        onSelect: (_event, isSelecting) => onSelectAll(isSelecting),
                        isSelected: isAllSelected(),
                      }}
                    />
                    <Th>Message ID</Th>
                    <Th>Body</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {getPage().map((m, index) => {
                    return (
                      <Tr key={index}>
                        <Td
                          style={{ flex: 1 }}
                          select={{
                            rowIndex: index,
                            onSelect: (_event, isSelected) => {
                              onSelect(m.messageId, isSelected)
                            },
                            isSelected: selected.includes(m.messageId),
                          }}
                        />
                        <Td style={{ width: '20%' }}>
                          <MessageDetails
                            aria-label={`message-details ${m.messageId}`}
                            message={m}
                            endpoints={endpoints}
                            mid={m.messageId}
                            index={getFromIndex() + index}
                            getMessage={handleNextMessage}
                            forwardMessages={forwardMessages}
                            maxValue={filteredMessages.length}
                          />
                        </Td>
                        <Td style={{ flex: 3 }}>{getSubstring(m.body)}</Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </FormGroup>
          )}
          {filteredMessages.length === 0 && (
            <Bullseye>
              <EmptyState icon={SearchIcon}>
                <EmptyStateBody>No results found.</EmptyStateBody>
              </EmptyState>
            </Bullseye>
          )}
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}

const ForwardMessagesModal: React.FunctionComponent<{
  onForwardMessages: (uri: string, message?: MessageData) => void
  enabled: boolean
  endpoints: string[]
}> = ({ onForwardMessages, enabled, endpoints }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleModalToggle = () => {
    setIsModalOpen(prevIsModalOpen => !prevIsModalOpen)
  }

  return (
    <React.Fragment>
      <Button isDisabled={!enabled} onClick={handleModalToggle} data-testid='forward-button'>
        Forward
      </Button>
      <Modal
        bodyAriaLabel='forward-message-modal'
        aria-label='forward-message-modal'
        position='top'
        tabIndex={0}
        variant='small'
        title='Forward Messages'
        isOpen={isModalOpen}
        onClose={handleModalToggle}
        style={{ overflow: 'visible' }}
      >
        <ForwardMessagesComponent endpoints={endpoints} onForwardMessages={onForwardMessages} />
      </Modal>
    </React.Fragment>
  )
}

const ForwardMessagesComponent: React.FunctionComponent<{
  onForwardMessages: (uri: string, message?: MessageData) => void
  currentMessage?: MessageData
  endpoints: string[]
}> = ({ onForwardMessages, currentMessage, endpoints }) => {
  const [uri, setUri] = useState('')

  return (
    <FormGroup label='URI:'>
      <Flex>
        <FlexItem flex={{ default: 'flexNone', md: 'flex_3' }}>
          <InputWithSuggestions suggestions={endpoints} value={uri} onChange={setUri} />
        </FlexItem>
        <FlexItem flex={{ default: 'flexNone', md: 'flex_1' }}>
          <Button key='confirm' variant='primary' onClick={() => onForwardMessages(uri, currentMessage)}>
            Forward
          </Button>
        </FlexItem>
      </Flex>
    </FormGroup>
  )
}

const MessageHeader: React.FunctionComponent<{
  currentIndex: number
  maxValue: number
  switchToMessage: (index: number) => void
}> = ({ currentIndex, maxValue, switchToMessage }) => {
  return (
    <div
      aria-label='message-details-header'
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
    >
      <Title aria-label='message-header-tittle' headingLevel='h2' style={{ marginRight: '10px' }}>
        Message
      </Title>
      <MessageSelect
        aria-label='message-header-messageSelector'
        value={currentIndex + 1}
        min={1}
        max={maxValue}
        onPrevious={() => switchToMessage(currentIndex - 1)}
        onNext={() => switchToMessage(currentIndex + 1)}
        onLast={() => switchToMessage(maxValue - 1)}
        onFirst={() => switchToMessage(0)}
      />
    </div>
  )
}

const MessagesPagination: React.FunctionComponent<{
  page: number
  setPage: (page: number) => void
  perPage: number
  setPerPage: (perPage: number) => void
  filteredMessages: MessageData[]
}> = ({ page, setPage, perPage, setPerPage, filteredMessages }) => {
  return (
    <Pagination
      itemCount={filteredMessages.length}
      page={page}
      perPage={perPage}
      onSetPage={(_evt, value) => setPage(value)}
      onPerPageSelect={(_evt, value) => setPerPage(value)}
      variant='top'
    />
  )
}

const MessageDetails: React.FunctionComponent<{
  message: MessageData
  mid: string
  index: number
  maxValue: number
  getMessage: (index: number) => MessageData | null
  forwardMessages: (uri: string, message?: MessageData) => void
  endpoints: string[]
}> = ({ message, mid, index, maxValue, getMessage, forwardMessages, endpoints }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentMessage, setCurrentMessage] = useState<MessageData>(message)
  const [currentIndex, setCurrentIndex] = useState<number>(index)

  const handleModalToggle = () => {
    setIsModalOpen(prevIsModalOpen => !prevIsModalOpen)
    setCurrentMessage(message)
    setCurrentIndex(index)
  }

  const switchToMessage = (index: number) => {
    const message = getMessage(index)
    if (message) {
      setCurrentMessage(message)
      setCurrentIndex(index)
    }
  }

  return (
    <React.Fragment>
      <Button variant='link' onClick={handleModalToggle}>
        {mid}
      </Button>
      <Modal
        aria-label='Message-details-label'
        tabIndex={0}
        data-testid={'message-details'}
        position={Position.Top}
        variant={ModalVariant.large}
        title={'Message Details'}
        isOpen={isModalOpen}
        onClose={handleModalToggle}
        header={
          <MessageHeader
            aria-label='header'
            currentIndex={currentIndex}
            maxValue={maxValue}
            switchToMessage={switchToMessage}
          />
        }
      >
        <br />
        <ForwardMessagesComponent
          endpoints={endpoints}
          currentMessage={currentMessage}
          onForwardMessages={forwardMessages}
        />
        <FormGroup label='ID' frameBorder={1}>
          {currentMessage.messageId}
        </FormGroup>
        <br />
        <FormGroup label='Body'>
          <CodeBlock>
            <CodeBlockCode>{currentMessage.body}</CodeBlockCode>
          </CodeBlock>
        </FormGroup>
        <br />
        <FormGroup label='Headers'>
          <Table variant='compact'>
            <Thead aria-label='headers-table-header'>
              <Tr>
                <Td label='Key'>Key</Td>
                <Td label='Type'>Type</Td>
                <Td label='Value'>Value</Td>
              </Tr>
            </Thead>
            <Tbody>
              {currentMessage.headers.map((header, index) => {
                return (
                  <Tr key={index + 'row'}>
                    <Td>{header.key}</Td>
                    <Td>{header.type}</Td>
                    <Td>{header.value}</Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </FormGroup>
      </Modal>
    </React.Fragment>
  )
}

const MessageSelect: React.FunctionComponent<{
  min: number
  max: number
  value: number
  onNext: () => void
  onPrevious: () => void
  onFirst: () => void
  onLast: () => void
}> = ({ min, max, value, onNext, onPrevious, onFirst, onLast }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '300px' }}>
      <Button
        icon={'<<'}
        data-testid='first-message-button'
        variant='plain'
        onClick={onFirst}
        isDisabled={value === min}
      />
      <Button
        icon={'<'}
        data-testid='previous-message-button'
        variant='plain'
        onClick={onPrevious}
        isDisabled={value === min}
      />
      <TextInput id='current-message-index' value={`${value}/${max}`} readOnly />
      <Button
        icon={'>'}
        data-testid='next-message-button'
        variant='plain'
        onClick={onNext}
        isDisabled={value === max}
      />{' '}
      <Button
        icon={'>>'}
        data-testid='last-message-button'
        variant='plain'
        onClick={onLast}
        isDisabled={value === max}
      />
    </div>
  )
}
