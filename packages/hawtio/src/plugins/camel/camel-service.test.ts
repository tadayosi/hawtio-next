import * as camel4_18 from '@hawtio/camel-model-v4_18'
import * as camel4_22 from '@hawtio/camel-model-v4_22'
import { MBeanNode } from '@hawtiosrc/plugins/shared/tree'
import * as camelService from './camel-service'
import { contextNodeType, endpointNodeType, endpointsType, jmxDomain } from './globals'

jest.mock('@hawtiosrc/plugins/shared/jolokia-service')

describe('camel-service', () => {
  test('setChildProperties', () => {
    const domainNode = new MBeanNode(null, jmxDomain, true)
    const endpointsNode = domainNode.create(endpointsType, true)

    const childNames = [
      'mock://result',
      'quartz://cron?cron=0%2F10+*+*+*+*+%3F',
      'quartz://simple?trigger.repeatInterval=10000',
      'stream://out',
    ]
    for (const childName of childNames) {
      endpointsNode.create(childName, false)
    }

    expect(domainNode.childCount()).toBe(1)
    expect(domainNode.getChildren()).toContain(endpointsNode)
    expect(endpointsNode.childCount()).toBe(4)

    endpointsNode.setType(endpointsType)
    camelService.setDomain(endpointsNode)
    camelService.setChildProperties(endpointsNode, endpointNodeType)

    expect(endpointsNode.getType()).toBe(endpointsType)
    expect(endpointsNode.getMetadata('domain')).toBe(jmxDomain)
    for (const child of endpointsNode.getChildren()) {
      expect(child.getType()).toBe(endpointNodeType)
      expect(child.getMetadata('domain')).toBe(jmxDomain)
    }
  })

  test('getCamelModel', async () => {
    const camel3Node = new MBeanNode(null, 'test-context-camel3', true)
    camel3Node.addMetadata('domain', jmxDomain)
    camel3Node.setType(contextNodeType)
    camel3Node.addMetadata('version', '3.21.0')
    const camel3Model = await camelService.getCamelModel(camel3Node)
    expect(camel3Model).toBeDefined()
    expect(camel3Model.apacheCamelModelVersion).toBe(camel4_18.apacheCamelModelVersion)
    expect(camel3Model.components).not.toBeUndefined()
    expect(camel3Model.dataformats).not.toBeUndefined()
    expect(camel3Model.definitions).not.toBeUndefined()
    expect(camel3Model.languages).not.toBeUndefined()
    expect(camel3Model.rests).not.toBeUndefined()

    const camel40Node = new MBeanNode(null, 'test-context-camel4_0', true)
    camel40Node.addMetadata('domain', jmxDomain)
    camel40Node.setType(contextNodeType)
    camel40Node.addMetadata('version', '4.0.4')
    const camel4Model = await camelService.getCamelModel(camel40Node)
    expect(camel4Model).toBeDefined()
    expect(camel4Model.apacheCamelModelVersion).toBe(camel4_18.apacheCamelModelVersion)
    expect(camel4Model.components).not.toBeUndefined()
    expect(camel4Model.dataformats).not.toBeUndefined()
    expect(camel4Model.definitions).not.toBeUndefined()
    expect(camel4Model.languages).not.toBeUndefined()
    expect(camel4Model.rests).not.toBeUndefined()

    const camel410Node = new MBeanNode(null, 'test-context-camel4_10', true)
    camel410Node.addMetadata('domain', jmxDomain)
    camel410Node.setType(contextNodeType)
    camel410Node.addMetadata('version', '4.10.0')
    const camel410Model = await camelService.getCamelModel(camel410Node)
    expect(camel410Model).toBeDefined()
    expect(camel410Model.apacheCamelModelVersion).toBe(camel4_18.apacheCamelModelVersion)
    expect(camel410Model.components).not.toBeUndefined()
    expect(camel410Model.dataformats).not.toBeUndefined()
    expect(camel410Model.definitions).not.toBeUndefined()
    expect(camel410Model.languages).not.toBeUndefined()
    expect(camel410Model.rests).not.toBeUndefined()

    const camel418Node = new MBeanNode(null, 'test-context-camel4_18', true)
    camel418Node.addMetadata('domain', jmxDomain)
    camel418Node.setType(contextNodeType)
    camel418Node.addMetadata('version', '4.18.0')
    const camel418Model = await camelService.getCamelModel(camel418Node)
    expect(camel418Model).toBeDefined()
    expect(camel418Model.apacheCamelModelVersion).toBe(camel4_18.apacheCamelModelVersion)
    expect(camel418Model.components).not.toBeUndefined()
    expect(camel418Model.dataformats).not.toBeUndefined()
    expect(camel418Model.definitions).not.toBeUndefined()
    expect(camel418Model.languages).not.toBeUndefined()
    expect(camel418Model.rests).not.toBeUndefined()

    const camel422Node = new MBeanNode(null, 'test-context-camel4_22', true)
    camel422Node.addMetadata('domain', jmxDomain)
    camel422Node.setType(contextNodeType)
    camel422Node.addMetadata('version', '4.22.0')
    const camel422Model = await camelService.getCamelModel(camel422Node)
    expect(camel422Model).toBeDefined()
    expect(camel422Model.apacheCamelModelVersion).toBe(camel4_22.apacheCamelModelVersion)
    expect(camel422Model.components).not.toBeUndefined()
    expect(camel422Model.dataformats).not.toBeUndefined()
    expect(camel422Model.definitions).not.toBeUndefined()
    expect(camel422Model.languages).not.toBeUndefined()
    expect(camel422Model.rests).not.toBeUndefined()

    const camel42xNode = new MBeanNode(null, 'test-context-camel4_24', true)
    camel42xNode.addMetadata('domain', jmxDomain)
    camel42xNode.setType(contextNodeType)
    camel42xNode.addMetadata('version', '4.24.0')
    const camel42xModel = await camelService.getCamelModel(camel42xNode)
    expect(camel42xModel).toBeDefined()
    expect(camel42xModel.apacheCamelModelVersion).toBe(camel4_22.apacheCamelModelVersion)
    expect(camel42xModel.components).not.toBeUndefined()
    expect(camel42xModel.dataformats).not.toBeUndefined()
    expect(camel42xModel.definitions).not.toBeUndefined()
    expect(camel42xModel.languages).not.toBeUndefined()
    expect(camel42xModel.rests).not.toBeUndefined()
  })

  test('compareVersions', () => {
    const versions = [
      { v: '2.2.0', ma: 1, mi: 0, r: 1 },
      { v: '2.2.0', ma: 2, mi: 0, r: 1 },
      { v: '2.2.0', ma: 3, mi: 0, r: -1 },
      { v: '2.2.0', ma: 2, mi: 1, r: 1 },
      { v: '2.2.0', ma: 2, mi: 2, r: 0 },
      { v: '2.2.0', ma: 2, mi: 3, r: -1 },
      { v: '2.3.4', ma: 2, mi: 3, r: 0 },
      { v: '1.2.3.4', ma: 1, mi: 2, r: 0 },
      { v: '1.2.3.4', ma: 2, mi: 2, r: -1 },
      { v: '1.2.3.4', ma: 4, mi: 2, r: -1 },
      { v: 'v1.2.3.4', ma: 0, mi: 0, r: 1 },
      { v: 'v1.2.3.4', ma: 1, mi: 0, r: -1 },
      { v: 'v1.2.3.4', ma: 2, mi: 0, r: -1 },
      { v: '2.2.3.0-alpha', ma: 1, mi: 3, r: 1 },
      { v: '2.2.3.0-alpha', ma: 2, mi: 3, r: -1 },
      { v: '2.2.3.0-alpha', ma: 2, mi: 2, r: 0 },
    ]

    for (const data of versions) {
      expect({
        v: data.v,
        ma: data.ma,
        mi: data.mi,
        r: camelService.compareVersions(data.v, data.ma, data.mi),
      }).toEqual(data)
    }
  })

  test('isCamelVersionEQGT', () => {
    const ctxNode = new MBeanNode(null, 'sample app', true)
    camelService.setDomain(ctxNode)
    ctxNode.setType(contextNodeType)

    const versions = [
      { v: '3.21.0', r: false },
      { v: '3.22.0-Beta1', r: false },
      { v: '4.0.0-RC1', r: true },
      { v: '4.0.0', r: true },
      { v: '4.1.0', r: true },
      { v: '5.0.0', r: true },
    ]
    for (const version of versions) {
      ctxNode.addMetadata('version', version.v)
      expect(camelService.isCamelVersionEQGT(ctxNode, 4, 0)).toBe(version.r)
    }
  })
})
