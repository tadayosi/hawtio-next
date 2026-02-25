import {
  ActionList,
  Alert,
  AlertActionLink,
  AlertGroup,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateVariant,
  Flex,
  Form,
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  Spinner,
  Stack,
  TextInput,
  Title,
} from '@patternfly/react-core'
import { Modal } from '@patternfly/react-core/deprecated'
import { CogIcon, CubesIcon, DownloadIcon, RecordVinylIcon, StopIcon } from '@patternfly/react-icons'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import React, { Fragment, useEffect, useRef, useState } from 'react'
import { jolokiaService } from '../shared'
import {
  CurrentRecording,
  flightRecorderService,
  JfrConfig,
  Recording,
  RecordingState,
  UserJfrSettings,
} from './flight-recorder-service'
import './FlightRecorder.css'

export const FlightRecorder: React.FunctionComponent = () => {
  const [initialized, setInitialized] = useState<boolean>(false)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [currentRecording, setCurrentRecording] = useState<CurrentRecording>()
  const [configurations, setConfigurations] = useState<JfrConfig[]>([])
  const [userJfrSettings, setUserJfrSettings] = useState<UserJfrSettings>()
  const [jolokiaUrl, setJolokiaUrl] = useState<string>()
  const [alerts, setAlerts] = useState<React.ReactNode[]>([])
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [isConfigurationsDropdownOpen, setIsConfigurationsDropdownOpen] = useState<boolean>(false)
  const [isLimitTypeOpen, setIsLimitTypeOpen] = useState<boolean>(false)
  const [startTimeRecording, setStartTimeRecording] = useState<number>(Date.now())

  const LIMIT_TYPE: { label: string; value: string }[] = [
    { label: 'Unlimited', value: 'unlimited' },
    { label: 'Duration', value: 'duration' },
    { label: 'Size', value: 'maxSize' },
  ]
  const humanReadableBytes = (bytes: number) => {
    const BYTE_DIVISOR = 1024
    const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    let unit = 0
    let currentDividedNumber = bytes

    while (currentDividedNumber > BYTE_DIVISOR) {
      unit++
      currentDividedNumber = currentDividedNumber / BYTE_DIVISOR
    }

    return currentDividedNumber.toFixed(0) + ' ' + UNITS[unit]
  }

  const isCurrentlyRecording = useRef(() => flightRecorderService.currentRecording.state)

  useEffect(() => {
    return () => {
      if (isCurrentlyRecording.current() == RecordingState.RECORDING) {
        flightRecorderService.stopRecording()
      }
    }
  }, [])

  useEffect(() => {
    if (!initialized)
      jolokiaService.getFullJolokiaUrl().then(url => {
        setJolokiaUrl(url)
      })

    flightRecorderService.setUp().then(() => {
      setInitialized(true)
      setRecordings(flightRecorderService.recordings)
      setCurrentRecording(flightRecorderService.currentRecording)
      setConfigurations(flightRecorderService.jfrConfigs || [])
      setUserJfrSettings(flightRecorderService.userJfrSettings)
    })
  }, [initialized])

  useEffect(() => {
    if (!initialized)
      jolokiaService.getFullJolokiaUrl().then(url => {
        setJolokiaUrl(url)
      })

    flightRecorderService.setUp().then(() => {
      setInitialized(true)
      setRecordings(flightRecorderService.recordings)
      setCurrentRecording(flightRecorderService.currentRecording)
      setConfigurations(flightRecorderService.jfrConfigs || [])
      setUserJfrSettings(flightRecorderService.userJfrSettings)
    })
  }, [initialized])

  if (!initialized) {
    return (
      <PageSection hasBodyWrapper={false}>
        <Spinner aria-label='Loading Flight Recorder' />
      </PageSection>
    )
  }

  if (
    !(
      initialized &&
      jolokiaUrl &&
      ['localhost', '127.0.0.1', '::1', '192.168.', '10.0'].filter(localUrl => jolokiaUrl.includes(localUrl)).length >=
        1
    )
  )
    return (
      <PageSection hasBodyWrapper={false}>
        <EmptyState
          headingLevel='h1'
          icon={CubesIcon}
          titleText='Tech preview only allows for local connections'
          variant={EmptyStateVariant.full}
        ></EmptyState>
      </PageSection>
    )

  if (initialized && !flightRecorderService.hasFlightRecorderMBean()) {
    return (
      <PageSection hasBodyWrapper={false}>
        <EmptyState
          headingLevel='h1'
          icon={CubesIcon}
          titleText='No MBean found for Java Flight Recorder'
          variant={EmptyStateVariant.full}
        ></EmptyState>
      </PageSection>
    )
  }

  const recordingAlert = (text: string, downloadId?: number, recordingName?: string, timeout?: number) => {
    setAlerts(prevAlerts => {
      let recordingNameForDownload: string = recordingName || downloadId?.toString() || 'recording'

      if (!recordingNameForDownload?.endsWith('.jfr')) recordingNameForDownload += '.jfr'

      return [
        ...prevAlerts,
        <Alert
          title={text}
          timeout={timeout ? timeout : 2000}
          actionLinks={
            downloadId && (
              <Fragment>
                <AlertActionLink
                  component='a'
                  onClick={async () => {
                    await flightRecorderService.downloadRecording(Number(downloadId), recordingNameForDownload)
                    saveRecordingAlert(recordingNameForDownload)
                  }}
                >
                  Download
                </AlertActionLink>
              </Fragment>
            )
          }
        ></Alert>,
      ]
    })
  }

  const startRecordingAlert = () => recordingAlert('Starting recording.')
  const stopRecordingAlert = (recordingId: number, recordingName: string) =>
    recordingAlert(`Recording ${recordingName} stored`, recordingId)
  const saveRecordingAlert = (recordingName: string) => recordingAlert(`Downloading recording ${recordingName}`)

  const SettingsModal = () => (
    <Modal
      title={`Settings for recording ${currentRecording?.number}`}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
    >
      <Form>
        <FormGroup label='Recording configuration'>
          <Dropdown
            isOpen={isConfigurationsDropdownOpen}
            onSelect={(_event, value) => {
              setUserJfrSettings({ ...userJfrSettings, configuration: value as string } as UserJfrSettings)
              setIsConfigurationsDropdownOpen(false)
            }}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                onClick={() => setIsConfigurationsDropdownOpen(true)}
                isExpanded={isConfigurationsDropdownOpen}
              >
                {configurations?.find(config => config.name === userJfrSettings?.configuration)?.label ??
                  'Select configuration'}
              </MenuToggle>
            )}
            onOpenChange={isOpen => setIsConfigurationsDropdownOpen(isOpen)}
            shouldFocusToggleOnSelect
          >
            <DropdownList>
              {configurations?.map(({ name, description, label }, index) => (
                <DropdownItem value={name} key={index} description={description}>
                  {label}
                </DropdownItem>
              ))}
            </DropdownList>
          </Dropdown>
        </FormGroup>
        <FormGroup label='Recording name'>
          <TextInput
            aria-label='Recording name'
            value={userJfrSettings?.name}
            onChange={(_event, value) =>
              setUserJfrSettings({ ...userJfrSettings, name: value, isUserSelectedName: true } as UserJfrSettings)
            }
          />
        </FormGroup>
        <FormGroup label='Limit'>
          <Stack hasGutter>
            <DropdownGroup label='Type'>
              <Dropdown
                isOpen={isLimitTypeOpen}
                onSelect={(_event, value) => {
                  setUserJfrSettings({
                    ...userJfrSettings,
                    limitType: value as string,
                    limitValue: value === 'unlimited' ? 0 : userJfrSettings?.limitValue,
                  } as UserJfrSettings)
                  setIsLimitTypeOpen(false)
                }}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setIsLimitTypeOpen(true)} isExpanded={isLimitTypeOpen}>
                    {LIMIT_TYPE.find(limitType => limitType.value === userJfrSettings?.limitType)?.label ||
                      `Select limit type`}
                  </MenuToggle>
                )}
                onOpenChange={(isOpen: boolean) => setIsLimitTypeOpen(isOpen)}
                shouldFocusToggleOnSelect
              >
                <DropdownList>
                  {LIMIT_TYPE.map(({ label, value }) => (
                    <DropdownItem key={value} value={value}>
                      {label}
                    </DropdownItem>
                  ))}
                </DropdownList>
              </Dropdown>
            </DropdownGroup>
            <TextInput
              type='number'
              label='Value'
              aria-label='Value'
              value={userJfrSettings?.limitValue || 0}
              isDisabled={userJfrSettings?.limitType === 'unlimited'}
              onChange={(_event, value) =>
                setUserJfrSettings({ ...userJfrSettings, limitValue: Number(value) } as UserJfrSettings)
              }
            />
          </Stack>
        </FormGroup>
        <Checkbox
          id='dump-on-exit-checkbox'
          label='Dump on exit'
          isChecked={userJfrSettings?.dumpOnExit}
          onChange={(_event, value) => setUserJfrSettings({ ...userJfrSettings, dumpOnExit: value } as UserJfrSettings)}
        />
      </Form>
    </Modal>
  )

  const RecordingTimer = ({ startTime }: { startTime: number }) => {
    const [timeRecording, setTimeRecording] = useState<number>(0)
    const currentTime = useRef(() => Math.round((Date.now() - startTime) / 1000))

    useEffect(() => {
      //This is a best effort as there were some problems trying to keep the state updated
      setTimeRecording(0)

      const intervalID = setInterval(() => {
        setTimeRecording(currentTime.current())
      }, 1000)

      return () => {
        clearInterval(intervalID)
      }
    }, [])

    return (
      <React.Fragment>
        <span>{timeRecording}s</span>
      </React.Fragment>
    )
  }

  return (
    <PageSection className='java-flight-recorder' hasBodyWrapper={false}>
      <SettingsModal />
      <AlertGroup isToast isLiveRegion>
        {alerts}
      </AlertGroup>
      <Stack hasGutter>
        <Card className='flight-recorder-button-divider' isPlain isCompact>
          <Flex direction={{ md: 'column' }} alignContent={{ md: 'alignContentCenter' }}>
            <CardHeader className='flight-recorder-recording-text'>
              <Title headingLevel='h3'>
                {currentRecording?.state == RecordingState.RECORDING ? (
                  <React.Fragment>
                    <span>Recording...</span>
                    <RecordingTimer startTime={startTimeRecording}></RecordingTimer>
                  </React.Fragment>
                ) : (
                  'Ready to record'
                )}
              </Title>
            </CardHeader>
            <ActionList>
              <Flex alignContent={{ md: 'alignContentCenter' }}>
                <Button
                  icon={<RecordVinylIcon />}
                  isDisabled={currentRecording?.state == RecordingState.RECORDING}
                  onClick={() =>
                    flightRecorderService.startRecording(userJfrSettings).then(() => {
                      startRecordingAlert()
                      setStartTimeRecording(Date.now())
                    })
                  }
                >
                  Start
                </Button>
                <Button
                  icon={<StopIcon />}
                  isDisabled={currentRecording?.state != RecordingState.RECORDING}
                  onClick={() => {
                    flightRecorderService.stopRecording().then(() => {
                      stopRecordingAlert(
                        currentRecording?.number as number,
                        userJfrSettings?.name || currentRecording?.number?.toString() || '',
                      )
                      setRecordings(flightRecorderService.recordings)
                      setCurrentRecording(flightRecorderService.currentRecording)
                      setUserJfrSettings(flightRecorderService.userJfrSettings)
                      setStartTimeRecording(Date.now())
                    })
                  }}
                >
                  Stop
                </Button>
                <Divider orientation={{ md: 'vertical' }} />
                <Button
                  icon={<CogIcon />}
                  variant='secondary'
                  isDisabled={currentRecording?.state == RecordingState.RECORDING}
                  onClick={() => setIsModalOpen(true)}
                >
                  Settings
                </Button>
              </Flex>
            </ActionList>
          </Flex>
        </Card>

        <Card isCompact>
          <Table variant='compact'>
            <Thead>
              <Tr>
                <Th>Record</Th>
                <Th>Name</Th>
                <Th>Size</Th>
                <Th>Date</Th>
                <Th>Download</Th>
              </Tr>
            </Thead>
            <Tbody>
              {recordings
                .sort((recordA, recordB) => Number(recordB.number) - Number(recordA.number))
                .map(({ number, file, size, time }) => (
                  <Tr key={number}>
                    <Td>{number}</Td>
                    <Td>{file}</Td>
                    <Td>{humanReadableBytes(Number.parseInt(size))}</Td>
                    <Td>{new Date(time).toUTCString()}</Td>
                    <Td modifier='fitContent' hasAction>
                      <Button
                        icon={<DownloadIcon />}
                        variant='secondary'
                        onClick={async () => {
                          await flightRecorderService.downloadRecording(Number(number), file)
                          saveRecordingAlert(file)
                        }}
                      />
                    </Td>
                  </Tr>
                ))}
            </Tbody>
          </Table>
        </Card>
      </Stack>
    </PageSection>
  )
}
