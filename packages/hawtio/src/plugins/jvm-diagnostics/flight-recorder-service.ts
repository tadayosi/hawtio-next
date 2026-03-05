import { jolokiaService, MBeanNode, workspace } from '../shared'
import { eventService } from '@hawtiosrc/core'

export interface IFlightRecorderService {
  hasFlightRecorderMBean(): Promise<boolean>
  setUp(): Promise<FlightRecorderService>
  startRecording(userJfrSettings?: UserJfrSettings): Promise<void>
  stopRecording(): Promise<void>
  downloadRecording(id: number, name: string): Promise<void>
}

export enum RecordingState {
  NOT_CREATED,
  CREATED,
  RECORDING,
  STOPPED,
}

export interface UserJfrSettings {
  limitType: 'duration' | 'maxSize' | 'unlimited'
  limitValue: number
  recordingNumber: number
  dumpOnExit: boolean
  name: string
  isUserSelectedName: boolean
  configuration: string
}

export type Recording = {
  number: string
  size: string
  file: string
  time: number
  canDownload: boolean
  downloadLink: string
}

export type CurrentRecording = {
  state: RecordingState
  number?: number
}

type RecordingDataJolokia = Partial<{
  state: string
  id: string
  size: number
  name: string
  stopTime: number
}>

type JfrOptionsJolokia = Partial<{
  duration?: number
  maxSize?: number
  configuration: string
  name: string
  dumpOnExit: string
}>

export type JfrConfig = {
  name: string
  label: string
  description: string
}

class FlightRecorderService implements IFlightRecorderService {
  private jfrMBean?: MBeanNode
  jfrConfigs?: JfrConfig[]
  userJfrSettings?: UserJfrSettings

  recordings: Array<Recording> = []
  currentRecording: CurrentRecording = { state: RecordingState.NOT_CREATED }
  initialized: boolean = false

  async setUp(): Promise<FlightRecorderService> {
    if (!this.jfrMBean) {
      const jfr = await this.getFlightRecoderMBean()

      if (!jfr) return this
    }

    await this.retrieveConfigurations()
    await this.retrieveRecordings()
    await this.retrieveSettings()

    this.initialized = true

    return this
  }

  async hasFlightRecorderMBean(): Promise<boolean> {
    if (!this.jfrMBean) {
      await this.getFlightRecoderMBean()
    }

    return this.jfrMBean !== undefined
  }

  private async getFlightRecoderMBean(): Promise<MBeanNode | undefined> {
    if (this.jfrMBean) return this.jfrMBean

    await workspace
      .findMBeans('jdk.management.jfr', { type: 'FlightRecorder' })
      .then(mbeans => (this.jfrMBean = mbeans[0]))

    return this.jfrMBean
  }

  private async retrieveConfigurations(): Promise<JfrConfig[] | undefined> {
    if (this.jfrConfigs) return this.jfrConfigs

    if (!this.jfrMBean) await this.getFlightRecoderMBean()

    this.jfrConfigs = (
      (await jolokiaService.readAttribute(this.jfrMBean?.objectName as string, 'Configurations').catch(e => {
        eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(e) })
        return []
      })) as Array<{ name: string; label: string; description: string }> | undefined
    )?.map(config => ({ name: config.name, label: config.label, description: config.description }))

    return this.jfrConfigs
  }

  private async retrieveRecordings(): Promise<[Recording[], CurrentRecording, RecordingDataJolokia[]]> {
    if (!this.jfrMBean) await this.getFlightRecoderMBean()

    const jfrRecordings: Array<RecordingDataJolokia> | undefined = (await jolokiaService
      .readAttribute(this.jfrMBean?.objectName as string, 'Recordings')
      .catch(e => {
        eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(e) })
        return []
      })) as Array<RecordingDataJolokia>

    this.recordings = await this.listSavedRecordings(jfrRecordings)
    this.currentRecording = await this.configureCurrentRecording(jfrRecordings)

    return [this.recordings || [], this.currentRecording, jfrRecordings]
  }

  private async listSavedRecordings(jfrRecordings: Array<RecordingDataJolokia>): Promise<Recording[]> {
    const jolokiaUrl = await jolokiaService.getFullJolokiaUrl()

    return jfrRecordings
      .filter(recording => recording?.state === 'STOPPED')
      .map(
        recording =>
          ({
            number: '' + recording.id,
            size: `${recording.size}`,
            file: `${recording.name}.jfr`,
            time: recording.stopTime,
            canDownload: true,
            downloadLink: `${jolokiaUrl}/exec/jdk.management.jfr:type=FlightRecorder/copyTo(long,java.lang.String)/${recording.id}/${recording.id}.jfr`,
          }) as Recording,
      )
  }

  private async configureCurrentRecording(jfrRecordings: Array<RecordingDataJolokia>): Promise<CurrentRecording> {
    const current = jfrRecordings && jfrRecordings.length > 0 && jfrRecordings[jfrRecordings.length - 1]

    if (current && current?.state === 'RUNNING')
      return {
        state: RecordingState.RECORDING,
        number: Number(jfrRecordings?.[jfrRecordings.length - 1]?.id),
      }

    if (current && current?.state === 'NEW')
      return {
        state: RecordingState.CREATED,
        number: Number(jfrRecordings?.[jfrRecordings.length - 1]?.id),
      }

    return {
      state: RecordingState.CREATED,
      number: (await jolokiaService.execute(this.jfrMBean?.objectName as string, 'newRecording')) as number,
    }
  }

  private async retrieveSettings(): Promise<UserJfrSettings> {
    if (!this.jfrMBean) await this.getFlightRecoderMBean()
    if (!this.currentRecording) await this.retrieveRecordings()

    const initialSettings = (await jolokiaService.execute(this.jfrMBean?.objectName as string, 'getRecordingOptions', [
      this.currentRecording?.number,
    ])) as JfrOptionsJolokia

    const limitType =
      Number(initialSettings['duration']) !== 0
        ? 'duration'
        : Number(initialSettings['maxSize']) !== 0
          ? 'maxSize'
          : 'unlimited'

    this.userJfrSettings = {
      configuration: initialSettings['configuration'] || 'default',
      name: initialSettings['name'] as string,
      isUserSelectedName: this.userJfrSettings?.isUserSelectedName || false,
      dumpOnExit: initialSettings['dumpOnExit'] === 'true',
      recordingNumber: this.currentRecording?.number as number,
      limitType: limitType,
      limitValue: limitType !== 'unlimited' ? Number(initialSettings[limitType]) : 0,
    }

    return this.userJfrSettings
  }

  async startRecording(userJfrSettings?: UserJfrSettings): Promise<void> {
    this.userJfrSettings = { ...this.userJfrSettings, ...(userJfrSettings || {}) } as UserJfrSettings
    await jolokiaService.execute(this.jfrMBean?.objectName as string, 'setRecordingOptions', [
      this.currentRecording?.number,
      this.convertSettingsToJfrOptions(this.userJfrSettings),
    ])
    await jolokiaService.execute(this.jfrMBean?.objectName as string, 'setPredefinedConfiguration', [
      this.currentRecording?.number,
      this.userJfrSettings?.configuration,
    ])
    await jolokiaService.execute(this.jfrMBean?.objectName as string, 'startRecording', [this.currentRecording?.number])
    this.currentRecording.state = RecordingState.RECORDING
  }

  async stopRecording(): Promise<void> {
    await jolokiaService.execute(this.jfrMBean?.objectName as string, 'stopRecording', [this.currentRecording.number])
    await this.retrieveRecordings()

    if (this.userJfrSettings && !this.userJfrSettings?.isUserSelectedName && this.recordings.length > 0) {
      const previousRecording = this.recordings[this.recordings.length - 1]

      this.userJfrSettings.name = (Number(previousRecording?.number) + 1).toString() || ''
    }
  }

  async downloadRecording(id: number, name: string) {
    const fileData: Uint8Array = await this.retrieveFileData(id)
    const fileUrl = URL.createObjectURL(new Blob([fileData as BufferSource], { type: 'application/octet-stream' }))
    const fileDownload = document.createElement('a')
    fileDownload.href = fileUrl
    fileDownload.download = `${name}`
    fileDownload.click()
    URL.revokeObjectURL(fileDownload.toString())
  }

  private async retrieveFileData(id: number): Promise<Uint8Array> {
    const responses: Uint8Array[] = []
    let fileRead = false

    const streamToRead = await jolokiaService.execute(
      this.jfrMBean?.objectName as string,
      'openStream(long, javax.management.openmbean.TabularData)',
      [id, {}],
    )

    while (!fileRead)
      await jolokiaService
        .execute(this.jfrMBean?.objectName as string, 'readStream(long)', [streamToRead])
        .then(response => {
          //If the value comes as null, the stream has ended transmiting.
          if (!response) {
            fileRead = true
            return
          }

          responses.push(new Uint8Array(response as number[]))
        })

    await jolokiaService.execute(this.jfrMBean?.objectName as string, 'closeStream(long)', [streamToRead])

    return this.concatenateUInt32Array(responses)
  }

  private convertSettingsToJfrOptions(jfrOptions: UserJfrSettings) {
    return {
      name: '' + jfrOptions.name,
      dumpOnExit: '' + jfrOptions.dumpOnExit,
      duration: jfrOptions.limitType === 'duration' ? `${jfrOptions.limitValue}s` : undefined,
      maxSize: jfrOptions.limitType === 'maxSize' ? jfrOptions.limitValue : undefined,
    }
  }

  private concatenateUInt32Array(uint8arrays: Uint8Array[]) {
    // Determine the length of the result.
    const totalLength = uint8arrays.reduce((total, uint8Array) => total + uint8Array.byteLength, 0)

    // Allocate the result.
    const result = new Uint8Array(totalLength)

    // Copy each Uint8Array into the result.
    let offset = 0
    uint8arrays.forEach(uint8arrays => {
      result.set(uint8arrays, offset)
      offset += uint8arrays.byteLength
    })

    return result
  }
}

export const flightRecorderService = new FlightRecorderService()
