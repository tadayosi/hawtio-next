import { PluginNodeSelectionContext } from '@hawtiosrc/plugins/context'
import { HawtioEmptyCard, HawtioLoadingCard } from '@hawtiosrc/plugins/shared'
import { AttributeValues } from '@hawtiosrc/plugins/shared/jolokia-service'
import { MBeanNode } from '@hawtiosrc/plugins/shared/tree'
import { isNumber } from '@hawtiosrc/util/objects'
import { ChartArea, ChartAxis, Chart as ChartDraw, ChartVoronoiContainer } from '@patternfly/react-charts/victory'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  getResizeObserver,
  Grid,
  GridItem,
  Switch,
  Title,
} from '@patternfly/react-core'
import { Table, Tbody, Td, Tr } from '@patternfly/react-table'
import Jolokia, {
  JolokiaErrorResponse,
  JolokiaFetchErrorResponse,
  JolokiaSuccessResponse,
  ReadRequest,
} from 'jolokia.js'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { attributeService } from '../attributes/attribute-service'
import { WatchableAttributesForm } from './WatchableAttributesForm'
import './Chart.css'

// TODO: this component has some eslint warnings about missing effect dependencies.
//  But adding them and using callbacks breaks the behavior

type MBeanChartData = {
  [name: string]: { attributes: AttributeChartEntries }
}

type AttributeChartEntries = {
  [name: string]: {
    data: {
      time: number
      value: number
    }[]
    min: number
    hasConstantValue: boolean
  }
}
type AttributesEntry = { [attName: string]: { time: number; value: number } }

export type AttributesToWatch = {
  [name: string]: { [attributeName: string]: boolean }
}
const AttributeChart: React.FunctionComponent<{
  name: string
  data: { name: string; x: number; y: number }[]
  min?: number
}> = ({ name, data, min }) => {
  const [width, setWidth] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleResize = () => {
    if (containerRef.current && containerRef.current.clientWidth) {
      setWidth(containerRef.current.clientWidth)
    }
  }

  useEffect(() => {
    const observer = getResizeObserver(containerRef.current!, handleResize, true)
    handleResize()
    return () => observer()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '220px' }}>
      <ChartDraw
        ariaTitle={name}
        containerComponent={
          <ChartVoronoiContainer labels={({ datum }) => `${datum.name}: ${datum.y}`} constrainToVisibleArea />
        }
        name={name}
        key={name}
        height={220}
        width={width}
        padding={{ left: 160, top: 30, bottom: 30, right: 20 }}
        minDomain={{ y: min }}
      >
        <ChartArea data={data} />
        <ChartAxis
          fixLabelOverlap
          orientation='bottom'
          tickFormat={time => {
            const date = new Date(time * 1000)
            return [
              date.getHours() >= 10 ? date.getHours() : '0' + date.getHours(),
              date.getMinutes() >= 10 ? date.getMinutes() : '0' + date.getMinutes(),
              date.getSeconds() >= 10 ? date.getSeconds() : '0' + date.getSeconds(),
            ].join(':')
          }}
        />
        <ChartAxis dependentAxis showGrid />
      </ChartDraw>
    </div>
  )
}

export const Chart: React.FunctionComponent = () => {
  const { selectedNode } = useContext(PluginNodeSelectionContext)
  const [chartData, setChartData] = useState<MBeanChartData>({})
  const [attributesToWatch, setAttributesToWatch] = useState<AttributesToWatch>({})
  const [initialTime, setInitialTime] = useState<number>(-1)
  const [showConstants, setShowConstants] = useState<boolean>(true)
  const [isWatchableAttributesModalOpen, setIsWatchableAttributesModalOpen] = useState<boolean>(false)

  function updateNumericAttributesToWatch(
    currentWatchedAttributes: { [attributeName: string]: boolean },
    newData: AttributesEntry,
  ) {
    //Now we set it if it's not already set
    Object.entries(newData).forEach(([name, _value]) => {
      if (currentWatchedAttributes[name] === undefined) {
        currentWatchedAttributes[name] = true
      }
    })
  }

  function updateNode(mbeanObjectName: string, data: AttributesEntry): void {
    setChartData(chartData => {
      if (!chartData[mbeanObjectName]) {
        chartData[mbeanObjectName] = {
          attributes: {},
        }
      }

      const objectChartData = chartData[mbeanObjectName]!
      //for every attribute
      Object.entries(data).forEach(([attributeName, data]) => {
        if (!objectChartData.attributes[attributeName]) {
          objectChartData.attributes[attributeName] = {
            data: [],
            min: Number.MAX_SAFE_INTEGER,
            hasConstantValue: true,
          }
        }

        const attributeChartData = objectChartData.attributes[attributeName]!
        // Don't add repeated responses to avoid duplicate points
        if (!attributeChartData.data.find(entry => entry.time === data.time)) {
          attributeChartData.data.push(data)

          //track the min value for setting the min domain
          if (data.value < attributeChartData.min) {
            attributeChartData.min = data.value
          }

          if (
            attributeChartData.data.length > 1 &&
            attributeChartData.data[0]!.value !== data.value &&
            attributeChartData.hasConstantValue
          ) {
            attributeChartData.hasConstantValue = false
          }
        }
      })

      if (!attributesToWatch[mbeanObjectName]) {
        attributesToWatch[mbeanObjectName] = {}
      }

      const current = attributesToWatch[mbeanObjectName] ?? {}
      updateNumericAttributesToWatch(current, data)

      return { ...chartData }
    })
    attributesToWatch.current = { ...attributesToWatch.current }
  }

  function updateChartData(mbeanObjectName: string, data: AttributesEntry): void {
    if (!selectedNode) return
    else updateNode(mbeanObjectName, data)
  }

  function extractChartDataFromResponse(
    response: JolokiaSuccessResponse | JolokiaErrorResponse | JolokiaFetchErrorResponse,
    nodeName: string,
  ) {
    if (!response || Jolokia.isResponseFetchError(response)) {
      return
    }
    if (typeof response !== 'object') {
      return
    }
    if ('error' in response) {
      return
    }
    const time = response.timestamp ?? Date.now() / 1000
    const attr = response.value as AttributeValues

    const attributesEntry: AttributesEntry = {}
    Object.entries(attr ?? {})
      .flatMap(value => {
        if (isNumber(value[1])) {
          return [value]
        }
        if (!Array.isArray(value[1]) && value[1] && typeof value[1] === 'object') {
          return Object.entries(value[1]).map(([k, v]) => [`${value[0]}/${k}`, v])
        }
        return [value]
      })
      .filter(value => isNumber(value[1]))
      .forEach(([attrName, value]) => {
        attributesEntry[attrName] = {
          time: time,
          value: value as number,
        }
      })
    updateChartData(nodeName, attributesEntry)
  }

  async function setJobsForNode(node: MBeanNode): Promise<void> {
    if (!node) return

    const nodes = [node, ...node.getChildren()]
    nodes
      .filter(node => node && node.objectName)
      .forEach(node => {
        attributeService.register(
          { type: 'read', mbean: node.objectName! },
          (response: JolokiaSuccessResponse | JolokiaErrorResponse | JolokiaFetchErrorResponse) =>
            extractChartDataFromResponse(response, node.name),
        )
      })
  }

  async function fetchChartData(node: MBeanNode) {
    if (!node) return

    const requests: ReadRequest[] = []
    const nodes = [node, ...node.getChildren()]
    nodes
      .filter(node => node && node.objectName)
      .forEach(node => requests.push({ type: 'read', mbean: node.objectName! }))

    const responses = await attributeService.bulkRequest(requests)
    responses.forEach(resp => {
      if (!('mbean' in resp)) {
        return
      }
      const req = resp.request as unknown as { mbean: string }
      let name = req.mbean.match(/name="([^"]+)"/)
      if (!name) {
        name = req.mbean.match(/type="([^"]+)"/)
      }
      if (name && name.length > 1) {
        extractChartDataFromResponse(resp, name![1] as string)
      }
    })
  }

  useEffect(() => {
    if (!selectedNode) {
      return
    }

    if (initialTime === -1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialTime(new Date().getTime())
    }
    fetchChartData(selectedNode)
    setJobsForNode(selectedNode)

    return () => {
      attributeService.unregisterAll()
      setChartData({})
      attributesToWatch.current = {}
      setInitialTime(-1)
    }
    // TODO: I have to disable this warning for now. The code works, and if I add related dependencies
    //  and use useCallbacks, it stops working...
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode])

  if (
    !selectedNode ||
    !(selectedNode.mbean || (selectedNode.getChildren() && selectedNode.getChildren().some(child => child.mbean)))
  ) {
    return null
  }

  if (Object.values(chartData).length === 0) {
    // Data is still loading
    return <HawtioLoadingCard />
  }

  if (Object.values(attributesToWatch).flatMap(node => Object.values(node)).length === 0) {
    // Data has been loaded but there are no numeric attributes.
    return <HawtioEmptyCard message='There are no chartable data in the MBean or its children.' />
  }

  const watchableAttributesForm = (
    <WatchableAttributesForm
      isOpen={isWatchableAttributesModalOpen}
      onClose={isClosed => setIsWatchableAttributesModalOpen(isClosed)}
      attributesToWatch={attributesToWatch}
      onAttributesToWatchUpdate={update => {
        setAttributesToWatch(update)
      }}
    />
  )

  if (
    !Object.values(attributesToWatch)
      .flatMap(node => Object.values(node))
      .some(isWatched => isWatched)
  ) {
    // No currently watched attributes.
    return (
      <React.Fragment>
        {watchableAttributesForm}
        <Card isPlain>
          <CardBody>
            <Alert
              isInline
              isPlain
              variant='info'
              title='There are currently no watches. Please click on the button to select any Chart.'
            />
          </CardBody>
        </Card>
      </React.Fragment>
    )
  }

  return (
    <React.Fragment>
      {watchableAttributesForm}
      <Grid hasGutter span={12} xl2={6} className='camel-chart'>
        <GridItem span={12}>
          <Card isPlain>
            <CardHeader
              actions={{
                actions: <Button onClick={() => setIsWatchableAttributesModalOpen(true)}>Edit watches</Button>,
                hasNoOffset: false,
              }}
            >
              <Switch
                id='jmx-chart-switch-show-constants'
                label='Show attributes with the constant value as a chart'
                isChecked={showConstants}
                onChange={(_event, checked) => setShowConstants(checked)}
              />
            </CardHeader>
          </Card>
        </GridItem>
        {Object.entries(chartData).map(([name, attributes]) =>
          Object.entries(attributes.attributes)
            .filter(([_, data]) => (showConstants ? true : !data.hasConstantValue))
            .map(
              ([attributeName, chartEntries]) =>
                attributesToWatch[name]![attributeName] && (
                  <GridItem key={attributeName}>
                    <Card key={attributeName} isCompact>
                      <CardHeader>
                        <Title headingLevel='h3'>
                          {name}: {attributeName}: {chartEntries.data[chartEntries.data.length - 1]!.value}
                        </Title>
                      </CardHeader>
                      <CardBody>
                        <AttributeChart
                          key={`${name}-${attributeName}`}
                          name={`${name}-${attributeName}`}
                          min={chartEntries.hasConstantValue ? 0 : chartEntries.min}
                          data={[
                            ...chartEntries.data.map(data => ({
                              name: new Date(data.time * 1000).toLocaleTimeString(),
                              x: data.time,
                              y: data.value,
                            })),
                          ]}
                        />
                      </CardBody>
                    </Card>
                  </GridItem>
                ),
            ),
        )}

        {!showConstants && (
          <GridItem>
            <Card isCompact>
              <CardTitle>Constant values</CardTitle>
              <CardBody>
                <Table variant='compact'>
                  <Tbody>
                    {Object.entries(chartData).map(([name, attributes]) =>
                      Object.entries(attributes.attributes).map(
                        ([attributeName, chartEntries]) =>
                          attributesToWatch[name]![attributeName] &&
                          chartEntries.hasConstantValue && (
                            <Tr key={'obj-' + name + '-' + attributeName}>
                              <Td>{attributeName}</Td>
                              <Td>{chartEntries.data[0]!.value}</Td>
                            </Tr>
                          ),
                      ),
                    )}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </GridItem>
        )}
      </Grid>
    </React.Fragment>
  )
}
