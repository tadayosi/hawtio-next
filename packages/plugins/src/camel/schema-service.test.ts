import { schemaService } from './schema-service'
import { apacheCamelModel } from '@hawtio/camel-model'
import { isObject } from '@hawtio/react/util/objects'
import path from 'path'
import fs from 'fs'

describe('schema-service', () => {
  test('lookupDefinition type extends', () => {
    const schemaPath = path.resolve(__dirname, 'testdata', 'extends-type-schema.json')
    const schemaText = fs.readFileSync(schemaPath, { encoding: 'utf8', flag: 'r' })
    const schema = JSON.parse(schemaText)

    let defn: Record<string, unknown> | null = schemaService.lookupDefinition('base', schema)
    expect(defn).not.toBeNull()
    let def: Record<string, unknown> = defn as Record<string, unknown>
    expect(def.type).toBe('object')
    expect(isObject(def['properties'])).toBeTruthy()
    expect(Object.entries(def['properties'] as object).length).toBe(2)

    defn = schemaService.lookupDefinition('typed', schema)
    expect(defn).not.toBeNull()
    def = defn as Record<string, unknown>
    expect(def.type).toBe('base')
    expect(isObject(def['properties'])).toBeTruthy()
    expect(Object.entries(def['properties'] as object).length).toBe(3)

    defn = schemaService.lookupDefinition('extended', schema)
    expect(defn).not.toBeNull()
    def = defn as Record<string, unknown>
    expect(def.type).toBe('object')
    expect(isObject(def['properties'])).toBeTruthy()
    expect(Object.entries(def['properties'] as object).length).toBe(3)
  })

  test('lookupDefinition of routes', () => {
    const routeDefn: Record<string, unknown> | null = schemaService.lookupDefinition('routes', apacheCamelModel)
    expect(routeDefn).not.toBeNull()
    const rd: Record<string, unknown> = routeDefn as Record<string, unknown>
    expect(rd.type).toBe('object')
    expect(rd.title).toBe('Routes')
    expect(rd.group).toBe('configuration')
    expect(rd.icon).toBe('generic24.png')
  })

  test('getSchema nodeId', () => {
    const routeDefn: Record<string, unknown> | null = schemaService.getSchema('routes')
    expect(routeDefn).not.toBeNull()

    const rd: Record<string, unknown> = routeDefn as Record<string, unknown>
    expect(rd.type).toBe('object')
    expect(rd.title).toBe('Routes')
    expect(rd.group).toBe('configuration')
    expect(rd.icon).toBe('generic24.png')
  })

  test('getSchema nodeDefn', () => {
    const routeDefn = {
      type: 'object',
      title: 'Routes',
      group: 'configuration',
      icon: 'generic24.png',
      description: 'A series of Camel routes',
      acceptInput: 'false',
      acceptOutput: 'false',
    }

    const rd: Record<string, unknown> | null = schemaService.getSchema(routeDefn)
    expect(rd).toBe(routeDefn)
  })
})
