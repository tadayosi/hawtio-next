import { HawtioPlugin } from '@hawtio/react/core'
import { treeProcessorRegistry } from '__root__/shared'
import { rbacTreeProcessor } from './tree-processor'

export const rbac: HawtioPlugin = () => {
  treeProcessorRegistry.add('rbac', rbacTreeProcessor)
}
