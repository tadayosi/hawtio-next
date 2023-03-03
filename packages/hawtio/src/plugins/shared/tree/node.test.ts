import { MBeanNode, PropertyList } from './node'

describe('MBeanNode', () => {
  test('populateMBean', () => {
    const mbean = {
      desc: 'Managed CamelContext',
      attr: {
        CamelId: {
          rw: false,
          type: 'java.lang.String',
          desc: 'Camel ID',
        },
        CamelVersion: {
          rw: false,
          type: 'java.lang.String',
          desc: 'Camel Version',
        },
        ExchangesTotal: {
          rw: false,
          type: 'long',
          desc: 'Total number of exchanges',
        },
        Redeliveries: {
          rw: false,
          type: 'long',
          desc: 'Number of redeliveries (internal only)',
        },
      },
      op: {
        getCamelId: {
          args: [],
          ret: 'java.lang.String',
          desc: 'CamelId',
        },
        start: {
          args: [],
          ret: 'void',
          desc: 'Start Camel',
        },
        stop: {
          args: [],
          ret: 'void',
          desc: 'Stop Camel (shutdown)',
        },
        sendBody: {
          args: [
            {
              name: 'p1',
              type: 'java.lang.String',
              desc: '',
            },
            {
              name: 'p2',
              type: 'java.lang.Object',
              desc: '',
            },
          ],
          ret: 'void',
          desc: 'Send body (in only)',
        },
      },
      canInvoke: true,
    }

    const node = new MBeanNode('test', 'test.node', 'test.node', false)
    node.populateMBean('context=SampleContext,type=context,name="SampleCamel"', mbean)
    expect(node.children).toHaveLength(1)
    let child = node.children?.[0]
    expect(child?.name).toEqual('SampleContext')
    expect(child?.children).toHaveLength(1)
    child = child?.children?.[0]
    expect(child?.name).toEqual('context')
    expect(child?.children).toHaveLength(1)
    child = child?.children?.[0]
    expect(child?.name).toEqual('SampleCamel')
    expect(child?.children).toBeUndefined()
    expect(child?.mbean).toBe(mbean)

    // TODO: test lock icon when canInvoke = false
  })
})

describe('PropertyList', () => {
  test('getPaths and objectName', () => {
    const node = new MBeanNode('test', 'org.apache.camel', 'org.apache.camel', false)
    const propList = new PropertyList(node, 'context=SampleContext,type=context,name="SampleCamel"')
    expect(propList.getPaths()).toEqual(['context', 'SampleContext', 'SampleCamel'])
    expect(propList.objectName()).toEqual('org.apache.camel:context=SampleContext,type=context,name="SampleCamel"')
  })
})
