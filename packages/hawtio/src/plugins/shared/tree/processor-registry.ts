import { MBeanTree } from './tree'

export type TreeProcessor = (tree: MBeanTree) => Promise<void>

export type TreeProcessors = {
  [name: string]: TreeProcessor
}

export interface ITreeProcessorRegistry {
  add(name: string, processor: TreeProcessor): void
  process(tree: MBeanTree): void
  getProcessors(): TreeProcessors
  reset(): void
}

class TreeProcessorRegistry implements ITreeProcessorRegistry {
  private processors: TreeProcessors = {}

  add(name: string, processor: TreeProcessor) {
    this.processors[name] = processor
  }

  process(tree: MBeanTree) {
    Object.values(this.processors).forEach(processor => processor(tree))
  }

  getProcessors(): TreeProcessors {
    return this.processors
  }

  reset() {
    this.processors = {}
  }
}

export const treeProcessorRegistry = new TreeProcessorRegistry()
