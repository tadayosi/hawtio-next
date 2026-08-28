import { HawtioEmptyCard, HawtioLoadingCard, MBeanNode } from '@hawtiosrc/plugins/shared'
import { childText, parseXML } from '@hawtiosrc/util/xml'
import { Button, Divider, Panel, PanelHeader, PanelMain, PanelMainBody, Content, Title } from '@patternfly/react-core'
import { BanIcon } from '@patternfly/react-icons/dist/esm/icons/ban-icon'
import { PlayIcon } from '@patternfly/react-icons/dist/esm/icons/play-icon'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import Jolokia, { JolokiaErrorResponse, JolokiaFetchErrorResponse, JolokiaSuccessResponse } from 'jolokia.js'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as camelService from '../camel-service'
import { CamelContext } from '../context'
import { debugService as ds } from '../debug'
import { MessageDrawer } from '../debug/MessageDrawer'
import { MessageData } from '../debug/debug-service'
import { log } from '../globals'
import { RouteDiagramContext, useRouteDiagramContext } from '../route-diagram-context'
import { RouteDiagram } from '../route-diagram/RouteDiagram'
import './Tracing.css'
import { tracingService as ts } from './tracing-service'

const MESSAGES_LIMIT = 500

export const Trace: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const { graphNodeData, setGraphNodeData, graphSelection, setGraphSelection, setShowStatistics } =
    useRouteDiagramContext()
  const [isReading, setIsReading] = useState(true)
  const [isTracing, setIsTracing] = useState(false)
  const [parsedMessages, setParsedMessages] = useState<MessageData[]>([])
  const [message, setMessage] = useState<MessageData>()

  const [msgPanelExpanded, setMsgPanelExpanded] = React.useState(false)

  const previousMessages = useRef<MessageData[]>([])

  const setMessages = (newMessages: MessageData[]) => {
    previousMessages.current = newMessages
    setParsedMessages(newMessages)
  }

  const populateRouteMessages = useCallback((value: string, routeNode: MBeanNode) => {
    log.debug('Populating response', value)

    if (!value) return

    // lets parse the XML DOM here...
    const xmlDoc = parseXML(value)
    let allMessages = xmlDoc.getElementsByTagName('fabricTracerEventMessage')
    if (!allMessages || !allMessages.length) {
      // lets try find another element name
      allMessages = xmlDoc.getElementsByTagName('backlogTracerEventMessage')
    }

    if (allMessages.length === 0) return // nothing new to add

    const newMsgs = []
    for (let idx = allMessages.length - 1; idx >= 0; --idx) {
      const message = allMessages[idx]
      if (!message) continue

      const routeId = childText(message, 'routeId')
      if (routeId !== routeNode.name) continue

      const msgData = ds.createMessageFromXml(message)
      if (!msgData) continue

      const toNode = childText(message, 'toNode')
      if (toNode) msgData.toNode = toNode

      newMsgs.push(msgData)
    }

    /*
     * Adds new messages to existing stack
     */
    const msgs = [...newMsgs, ...previousMessages.current]

    /*
     * Remove messages when the array reaches its limit
     * and the user isn't looking at a message details
     */
    if (msgs.length > MESSAGES_LIMIT) msgs.splice(MESSAGES_LIMIT)

    // TODO
    // Do we still need tracer status??
    // keep state of the traced messages on tracerStatus
    // tracerStatus.messages = $scope.messages;

    setMessages(msgs)
  }, [])

  /**
   * Called when isTracing is changed to reload tracing properties
   */
  const tracingChanges = useCallback(
    async (isTracing: boolean) => {
      if (!selectedNode) return

      // Unregister old handles
      ts.unregisterAll()

      setIsTracing(isTracing)
      await ts.setTracing(selectedNode, isTracing)

      const tracingNode = ts.getTracingBean(selectedNode)
      if (!tracingNode) return

      if (isTracing) {
        /*
         * Sets up polling and live updating of tracing
         */
        ts.register(
          {
            type: 'exec',
            mbean: tracingNode.objectName as string,
            operation: 'dumpAllTracedMessagesAsXml()',
          },
          (response: JolokiaSuccessResponse | JolokiaErrorResponse | JolokiaFetchErrorResponse) => {
            if (Jolokia.isResponseFetchError(response)) {
              log.debug('Scheduler - Trace (fetch error):', response)
              return
            }
            if (Jolokia.isError(response)) {
              log.debug('Scheduler - Trace (Jolokia error):', response.error)
              return
            }
            log.debug('Scheduler - Trace:', response.value)
            populateRouteMessages(response?.value as string, selectedNode)
          },
        )
      } else {
        setMessages([])
        ts.unregisterAll()
      }
    },
    [selectedNode, populateRouteMessages],
  )

  useEffect(() => {
    if (!selectedNode) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReading(true)

    ts.isTracing(selectedNode).then((value: boolean) => {
      ts.getTracedMessages(selectedNode).then((response: string) => populateRouteMessages(response, selectedNode))

      tracingChanges(value)
      setIsReading(false)
    })
  }, [selectedNode, tracingChanges, populateRouteMessages])

  /*********************************
   *
   * Functions called by events handlers in toolbars
   *
   *********************************/
  const onTracing = async () => {
    tracingChanges(!isTracing)
  }

  const onRowSelected = (message: MessageData) => {
    let nodeId = message.toNode ? message.toNode : ''
    const firstData = graphNodeData[0]
    if (nodeId === selectedNode?.name && firstData) {
      nodeId = firstData.cid
    }

    setMessage(message)
    setGraphSelection(nodeId)
  }

  const isRowSelected = (msg: MessageData): boolean => {
    return msg.uid === message?.uid
  }

  if (!selectedNode) {
    return <HawtioEmptyCard message='No selection has been made.' />
  }

  if (isReading) {
    return <HawtioLoadingCard />
  }

  /**
   * Button callback for opening and closing the message panel drawer
   */
  const onMessagePanelToggle = () => {
    setMsgPanelExpanded(!msgPanelExpanded)
  }

  return (
    <Panel>
      <PanelHeader id='trace-header-container'>
        <Title headingLevel='h3'>Tracing</Title>
        <Button
          variant='primary'
          size='sm'
          icon={!isTracing ? React.createElement(PlayIcon) : React.createElement(BanIcon)}
          onClick={onTracing}
          isDisabled={!camelService.canTrace(selectedNode)}
        >
          {!isTracing ? 'Start Tracing' : 'Stop Tracing'}
        </Button>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          {!isTracing && (
            <React.Fragment>
              <Content className='noTracing' data-testid='no-tracing' component='p'>
                Tracing allows you to send messages to a route and then step through and see the messages flow through a
                route to aid debugging and to help diagnose issues.
              </Content>
              <Content className='noTracing' data-testid='no-tracing2' component='p'>
                Once you start tracing, you can send messages to the input endpoints, then come back to this page and
                see the flow of messages through your route.
              </Content>
              <Content className='noTracing' data-testid='no-tracing3' component='p'>
                As you click on the message table, you can see which node in the flow it came through; moving the
                selection up and down in the message table lets you see the flow of the message through the diagram.
              </Content>
            </React.Fragment>
          )}
          {isTracing && (
            <MessageDrawer
              messages={message ? [message] : []}
              expanded={msgPanelExpanded}
              setExpanded={setMsgPanelExpanded}
            >
              <div id='trace-content'>
                <Panel id='route-diagram-tracing-view'>
                  <PanelMain>
                    <PanelMainBody>
                      <RouteDiagramContext.Provider
                        value={{
                          graphNodeData,
                          setGraphNodeData,
                          graphSelection,
                          setGraphSelection,
                          setShowStatistics,
                        }}
                      >
                        <RouteDiagram />
                      </RouteDiagramContext.Provider>
                    </PanelMainBody>
                  </PanelMain>
                </Panel>
                <Panel id='route-message-table'>
                  <PanelHeader>Messages</PanelHeader>
                  <Divider />
                  {parsedMessages.length === 0 && (
                    <PanelMain>
                      <PanelMainBody>
                        <Content className='tracing-on-no-messages' data-testid='tracing-on-no-messages' component='p'>
                          Awaiting tracing messages.
                        </Content>
                      </PanelMainBody>
                    </PanelMain>
                  )}
                  {parsedMessages.length !== 0 && (
                    <PanelMain>
                      <PanelMainBody id='route-message-table-body'>
                        <Table aria-label='message table' variant='compact' isStriped>
                          <Thead>
                            <Tr>
                              <Th>ID</Th>
                              <Th>To Node</Th>
                              <Th>Elapsed</Th>
                              <Th>Endpoint Uri</Th>
                              <Th>Is Remote?</Th>
                              <Th>Service Url</Th>
                              <Th>Protocol</Th>
                              <Th>Metadata</Th>
                            </Tr>
                          </Thead>
                          <Tbody isOddStriped>
                            {parsedMessages.map(message => (
                              <Tr
                                key={message.uid}
                                onRowClick={() => onRowSelected(message)}
                                isRowSelected={isRowSelected(message)}
                              >
                                <Td dataLabel='ID'>
                                  <Button variant='link' isDisabled={!message} onClick={onMessagePanelToggle}>
                                    {message.headers.breadcrumbId ? message.headers.breadcrumbId : message.uid}
                                  </Button>
                                </Td>
                                <Td dataLabel='ToNode'>{message.toNode}</Td>
                                <Td dataLabel='Elapsed'>{message.elapsed}ms</Td>
                                <Td dataLabel='EndpointUri'>{message.endpointUri}</Td>
                                <Td dataLabel='IsRemote'>{message.isRemoteEndpoint}</Td>
                                <Td dataLabel='ServiceUrl'>{message.endpointServiceUrl}</Td>
                                <Td dataLabel='Protocol'>{message.endpointServiceProtocol}</Td>
                                <Td dataLabel='Metadata'>{message.endpointServiceMetadata}</Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </PanelMainBody>
                    </PanelMain>
                  )}
                </Panel>
              </div>
            </MessageDrawer>
          )}
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
