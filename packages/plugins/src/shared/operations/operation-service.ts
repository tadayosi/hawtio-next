import { jolokiaService } from '__root__/connect/jolokia-service'
import { log } from '../globals'

class OperationService {
  async execute(mbean: string, operation: string, args: unknown[]): Promise<string> {
    log.debug('Execute:', mbean, '-', operation, '-', args)
    const response = await jolokiaService.execute(mbean, operation, args)
    if (!response || response === 'null') {
      return 'Operation Succeeded!'
    }
    if (typeof response === 'string') {
      const trimmed = response.trim()
      if (trimmed === '') {
        return 'Empty string'
      }
      return trimmed
    }
    // pretty printing
    return JSON.stringify(response, null, 2)
  }
}

export const operationService = new OperationService()
