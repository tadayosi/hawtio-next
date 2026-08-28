import { jolokiaService, workspace } from '@hawtiosrc/plugins'
import { HealthComponent, HealthData, JmxTrace, JolokiaHealthData, Logger, LoggerConfiguration, Trace } from './types'

class SpringBootService {
  isSpringBoot3 = true

  isActive(): Promise<boolean> {
    return workspace.treeContainsDomainAndProperties('org.springframework.boot')
  }

  setIsSpringBoot3(is: boolean) {
    this.isSpringBoot3 = is
  }

  async loadHealth(): Promise<HealthData> {
    const data = (await jolokiaService.execute(
      'org.springframework.boot:type=Endpoint,name=Health',
      'health',
    )) as JolokiaHealthData
    const healthComponents: HealthComponent[] = Object.entries(data.components).map(([componentName, component]) => {
      let details

      if (component.details) {
        details = Object.entries(component.details).map(([detailKey, detailValue]) => {
          const typ = typeof detailValue
          const value = ['string', 'number', 'boolean'].includes(typ)
            ? detailValue.toString()
            : Object.entries(detailValue).map(([key, value]) => ({ key, value }))

          return {
            key: detailKey,
            value: value,
          }
        })
      }

      return {
        name: componentName,
        status: component.status,
        details: component.details ? details : undefined,
      }
    })

    return { status: data.status, components: healthComponents }
  }

  async getInfo() {
    const properties: { key: string; value: string }[] = []
    const res = await jolokiaService.execute('org.springframework.boot:type=Endpoint,name=Info', 'info')
    Object.entries(res as object).forEach(([key, value]) => {
      const v =
        typeof value === 'string'
          ? value
          : JSON.stringify(value)
              .replaceAll('"', '')
              .replaceAll(':', '=')
              .replaceAll('={', ': [')

              .replaceAll(',', '; ')
              .replaceAll('}', ']')
              .slice(1, -1)
      properties.push({
        key,
        value: v,
      })
    })

    return properties
  }

  hasEndpoint(name: string): Promise<boolean> {
    return workspace.treeContainsDomainAndProperties('org.springframework.boot', { type: 'Endpoint', name: name })
  }

  async getLoggerConfiguration() {
    const data = (await jolokiaService.execute('org.springframework.boot:type=Endpoint,name=Loggers', 'loggers')) as {
      loggers: {
        [key: string]: {
          configuredLevel?: string
          effectiveLevel: string
        }
      }
      levels: string[]
    }

    const loggers: Logger[] = []

    Object.entries(data.loggers).forEach(([loggerName, loggerInfo]) => {
      const logger: Logger = {
        name: loggerName,
        configuredLevel: loggerInfo['configuredLevel'] == null ? loggerInfo.effectiveLevel : loggerInfo.configuredLevel,
        effectiveLevel: loggerInfo.effectiveLevel,
      }
      loggers.push(logger)
    })

    const loggerConfiguration: LoggerConfiguration = {
      levels: data.levels,
      loggers: loggers,
    }

    return loggerConfiguration
  }

  async configureLogLevel(loggerName: string, loggerLevel: string) {
    return await jolokiaService.execute('org.springframework.boot:type=Endpoint,name=Loggers', 'configureLogLevel', [
      loggerName,
      loggerLevel,
    ])
  }

  async loadTraces() {
    const traces: Trace[] = []
    let mbeanName = 'Httpexchanges'
    let mbeanOperation = 'httpExchanges'
    let jmxTraces: JmxTrace[]
    if (!this.isSpringBoot3) {
      mbeanName = 'Httptrace'
      mbeanOperation = 'traces'
    }
    const data = await jolokiaService.execute(
      `org.springframework.boot:type=Endpoint,name=${mbeanName}`,
      mbeanOperation,
    )
    if (this.isSpringBoot3) {
      jmxTraces = (data as { exchanges: JmxTrace[] }).exchanges
    } else {
      jmxTraces = (data as { traces: JmxTrace[] }).traces
    }

    jmxTraces
      .filter(trace => {
        const path = trace.info ? trace.info.path : (trace.request?.uri ?? '')
        // Avoid including our own jolokia requests in the results
        return !/.*?\/jolokia\/?(?:\/.*(?=$))?$/.test(path)
      })
      .forEach(jmxTrace => {
        traces.push(new Trace(jmxTrace))
      })
    return traces
  }
}

export const springbootService = new SpringBootService()
