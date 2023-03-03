import { treeProcessorRegistry } from '@hawtiosrc/plugins/shared'
import { rbacTreeProcessor } from './tree-processor'

export const rbac = () => {
  treeProcessorRegistry.add('rbac', rbacTreeProcessor)
}
