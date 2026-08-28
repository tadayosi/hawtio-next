import { HawtioEmptyCard, HawtioLoadingCard } from '@hawtiosrc/plugins/shared'
import { Label, LabelGroup, Panel, PanelMain, PanelMainBody } from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon'
import React, { useContext, useEffect, useState } from 'react'
import { CamelContext } from '../context'
import { log, xmlNodeLocalName } from '../globals'
import { routeStatsService } from '../route-stats-service'
import { schemaService } from '../schema-service'
import './Properties.css'
import { PropertiesList } from './PropertiesList'
import * as pps from './properties-service'
import { Property } from './property'

export const Properties: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [isReading, setIsReading] = useState(true)

  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState<React.ReactNode>()
  const [labels, setLabels] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [definedProperties, setDefinedProperties] = useState<Property[]>([])
  const [defaultProperties, setDefaultProperties] = useState<Property[]>([])
  const [undefinedProperties, setUndefinedProperties] = useState<Property[]>([])

  useEffect(() => {
    if (!selectedNode) return

    const init = async () => {
      setIsReading(true)
      const localName = selectedNode.getMetadata(xmlNodeLocalName) ?? ''
      const schemaKey = localName ? localName : selectedNode.name
      const schema = await schemaService.getSchema(selectedNode, schemaKey)

      let newTitle = localName
      let newIcon = selectedNode.icon
      let newDescription = ''
      let groups: string[] = []

      if (schema) {
        newTitle = schema['title'] as string
        newIcon = await routeStatsService.getIcon(selectedNode, schema, 24)
        newDescription = schema['description'] as string
        const groupStr = schema['group'] as string
        groups = groupStr.split(',')

        log.debug('Properties - schema:', schema)

        const schemaProps = schema['properties'] as Record<string, Record<string, string>>
        pps.populateProperties(selectedNode, schemaProps)

        setDefinedProperties(pps.getDefinedProperties(schemaProps))
        setDefaultProperties(pps.getDefaultProperties(schemaProps))
        setUndefinedProperties(pps.getUndefinedProperties(schemaProps))
      }

      setIcon(newIcon)
      setTitle(newTitle)
      setDescription(newDescription)
      setLabels(groups)

      setIsReading(false)
    }

    init()
  }, [selectedNode])

  if (!selectedNode) {
    return <HawtioEmptyCard message='No selection has been made.' />
  }

  if (isReading) {
    return <HawtioLoadingCard />
  }

  return (
    <React.Fragment>
      <Panel id='properties-card-body'>
        <PanelMain>
          <PanelMainBody id='properties-card-title-panel'>
            {icon}
            <span>{title}</span>
            <LabelGroup id='properties-card-title-panel-labelgroup'>
              {labels.map(label => (
                <Label key={label} icon={<InfoCircleIcon />}>
                  {label}
                </Label>
              ))}
            </LabelGroup>
          </PanelMainBody>
        </PanelMain>
      </Panel>
      {description && (
        <Panel>
          <PanelMain>
            <PanelMainBody id='properties-card-description-panel'>{description}</PanelMainBody>
          </PanelMain>
        </Panel>
      )}
      <PropertiesList title='Defined Properties' values={definedProperties} />
      <PropertiesList title='Default Properties' values={defaultProperties} />
      <PropertiesList title='Undefined Properties' values={undefinedProperties} />
    </React.Fragment>
  )
}
