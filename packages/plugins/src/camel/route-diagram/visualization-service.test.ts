import { visualizationService } from './visualization-service'
import path from 'path'
import fs from 'fs'

jest.mock('__root__/connect/jolokia-service')

describe('visualization-service', () => {
  const routesXmlPath = path.resolve(__dirname, '../testdata', 'camel-choice-route.xml')
  const sampleRoutesXml = fs.readFileSync(routesXmlPath, { encoding: 'utf8', flag: 'r' })

  describe('loadRouteXmlNodes', () => {
    test('nodes and edges were correctly loaded from the file', () => {
      const { camelNodes, edges } = visualizationService.loadRouteXmlNodes(sampleRoutesXml)
      expect(camelNodes.length).toBe(11)
      expect(camelNodes[1].data.cid).toBe('choice1')
      expect(camelNodes[1].data.label).toBe('Choice')
      expect(camelNodes[1].id).toBe('1')
      //find choice branches:
      const tmpEdges = edges.filter(e => e.source === '1')
      expect(tmpEdges.length).toBe(3)
      //check if otherwise is connected to choice
      const otherwise = camelNodes.find(n => n.id === tmpEdges[2].target)
      expect(otherwise?.data.label).toBe('Otherwise')

      const when1 = camelNodes.find(n => n.id === tmpEdges[0].target)
      expect(when1?.data.cid).toBe('when1')

      const when2 = camelNodes.find(n => n.id === tmpEdges[1].target)
      expect(when2?.data.cid).toBe('when2')

      // check if label is parsed correctly
      expect(when2?.data.label).toBe(`When: \${body} == 'Hello Camel! - simple'`)
    })
  })
})
