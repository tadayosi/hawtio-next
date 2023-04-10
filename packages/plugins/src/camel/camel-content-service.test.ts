import { MBeanNode } from '__root__/shared/tree'
import { jmxDomain, endpointNodeType, endpointsType, contextNodeType } from './globals'
import * as ccs from './camel-content-service'

jest.mock('__root__/connect/jolokia-service')

describe('camel-content-service', () => {
  test('syncChildProperties', async () => {
    const domainNode = new MBeanNode(null, jmxDomain, jmxDomain, true)
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

    ccs.setType(endpointsNode, endpointsType)
    ccs.setDomain(endpointsNode)
    ccs.setChildProperties(endpointsNode, endpointNodeType)

    expect(endpointsNode.getProperty('type')).toBe(endpointsType)
    expect(endpointsNode.getProperty('domain')).toBe(jmxDomain)
    for (const child of endpointsNode.getChildren()) {
      expect(child.getProperty('type')).toBe(endpointNodeType)
      expect(child.getProperty('domain')).toBe(jmxDomain)
    }
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
      expect(ccs.compareVersions(data.v, data.ma, data.mi)).toEqual(data.r)
    }
  })

  test('isCamelVersionEQGT', () => {
    const ctxNode = new MBeanNode(null, 'sampleapp', 'sampleapp', true)
    ccs.setDomain(ctxNode)
    ccs.setType(ctxNode, contextNodeType)

    let versions = [
      { v: '2.12', r: false },
      { v: '2.13', r: true },
      { v: '2.14', r: true },
      { v: '2.15', r: true },
      { v: '2.16', r: true },
      { v: '2.17', r: true },
    ]
    for (const version of versions) {
      ctxNode.addProperty('version', version.v)
      expect(ccs.isCamelVersionEQGT_2_13(ctxNode)).toBe(version.r)
    }

    versions = [
      { v: '2.12', r: false },
      { v: '2.13', r: false },
      { v: '2.14', r: true },
      { v: '2.15', r: true },
      { v: '2.16', r: true },
      { v: '2.17', r: true },
    ]
    for (const version of versions) {
      ctxNode.addProperty('version', version.v)
      expect(ccs.isCamelVersionEQGT_2_14(ctxNode)).toBe(version.r)
    }

    versions = [
      { v: '2.12', r: false },
      { v: '2.13', r: false },
      { v: '2.14', r: false },
      { v: '2.15', r: true },
      { v: '2.16', r: true },
      { v: '2.17', r: true },
    ]
    for (const version of versions) {
      ctxNode.addProperty('version', version.v)
      expect(ccs.isCamelVersionEQGT_2_15(ctxNode)).toBe(version.r)
    }

    versions = [
      { v: '2.12', r: false },
      { v: '2.13', r: false },
      { v: '2.14', r: false },
      { v: '2.15', r: false },
      { v: '2.16', r: true },
      { v: '2.17', r: true },
    ]
    for (const version of versions) {
      ctxNode.addProperty('version', version.v)
      expect(ccs.isCamelVersionEQGT_2_16(ctxNode)).toBe(version.r)
    }
  })
})
