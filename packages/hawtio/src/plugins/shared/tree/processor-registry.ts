import { log } from './globals'
import { MBeanTree } from './tree'

export type TreeProcessor = (tree: MBeanTree) => Promise<void>

export type TreeProcessors = {
  [name: string]: TreeProcessor
}

export interface ITreeProcessorRegistry {
  add(name: string, processor: TreeProcessor): void
  process(tree: MBeanTree): Promise<void>
  getProcessors(): TreeProcessors
  reset(): void
}

class TreeProcessorRegistry implements ITreeProcessorRegistry {
  private processors: TreeProcessors = {}

  add(name: string, processor: TreeProcessor) {
    this.processors[name] = processor
  }

  async process(tree: MBeanTree) {
    log.debug('Apply processors to tree:', this.processors)
    // Apply processors in sequence to ensure consistency in the processed tree
    for (const [name, processor] of Object.entries(this.processors)) {
      log.debug('Apply processor:', name)
      await processor(tree)
    }
  }

  getProcessors(): TreeProcessors {
    return this.processors
  }

  reset() {
    this.processors = {}
  }
}

export const treeProcessorRegistry = new TreeProcessorRegistry()
