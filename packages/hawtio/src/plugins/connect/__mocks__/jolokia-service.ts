import { IRequest, IResponseFn, ISimpleOptions } from 'jolokia.js'
import { AttributeValues, IJolokiaService, JolokiaListMethod } from '../jolokia-service'
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

  async register(request: IRequest, callback: IResponseFn): Promise<number> {
    return 0
  }

  unregister(handle: number) {
    // no-op
  }
}

export const jolokiaService = new MockJolokiaService()
