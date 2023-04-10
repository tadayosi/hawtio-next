import { AttributeValues, jolokiaService } from '__root__/connect/jolokia-service'
import { escapeMBean } from '@hawtio/react/util/jolokia'
import { IRequest, IResponseFn } from 'jolokia.js'
import { log } from '../globals'

class AttributeService {
  private handles: number[] = []

  async read(mbean: string): Promise<AttributeValues> {
    return await jolokiaService.readAttributes(mbean)
  }

  async register(request: IRequest, callback: IResponseFn) {
    const handle = await jolokiaService.register(request, callback)
    log.debug('Register handle:', handle)
    this.handles.push(handle)
  }

  unregisterAll() {
    log.debug('Unregister all handles:', this.handles)
    this.handles.forEach(handle => jolokiaService.unregister(handle))
    this.handles = []
  }

  async buildUrl(mbean: string, attribute: string): Promise<string> {
    const jolokiaUrl = await jolokiaService.getJolokiaUrl()
    return `${jolokiaUrl}/read/${escapeMBean(mbean)}/${attribute}`
  }
}

export const attributeService = new AttributeService()
