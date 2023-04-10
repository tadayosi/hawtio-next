import { IRequest, IResponse, IResponseFn, ISimpleOptions } from 'jolokia.js'
import { AttributeValues, IJolokiaService, JolokiaStoredOptions, JolokiaListMethod } from '../jolokia-service'
import jmxCamelResponse from './jmx-camel-tree.json'

class MockJolokiaService implements IJolokiaService {
  constructor() {
    console.log('Using mock jolokia service')
  }

  async getJolokiaUrl(): Promise<string | null> {
    return null
  }

  async getListMethod(): Promise<JolokiaListMethod> {
    return 0
  }

  async list(options: ISimpleOptions): Promise<unknown> {
    return jmxCamelResponse
  }

  async readAttributes(mbean: string): Promise<AttributeValues> {
    return {}
  }

  async readAttribute(mbean: string, attribute: string): Promise<unknown> {
    return null
  }

  async execute(mbean: string, operation: string, args?: unknown[]): Promise<unknown> {
    return {}
  }

  async search(mbeanPattern: string): Promise<string[]> {
    return []
  }

  async bulkRequest(requests: IRequest[]): Promise<IResponse[]> {
    return []
  }

  async register(request: IRequest, callback: IResponseFn): Promise<number> {
    return 0
  }

  unregister(handle: number) {
    // no-op
  }

  loadUpdateRate(): number {
    return 0
  }

  saveUpdateRate(value: number) {
    //no-op
  }

  loadAutoRefresh(): boolean {
    return false
  }

  saveAutoRefresh(value: boolean) {
    //no-op
  }

  loadJolokiaStoredOptions(): JolokiaStoredOptions {
    return {
      maxDepth: 0,
      maxCollectionSize: 0,
    }
  }

  saveJolokiaStoredOptions(options: JolokiaStoredOptions) {
    //no-op
  }
}

export const jolokiaService = new MockJolokiaService()
