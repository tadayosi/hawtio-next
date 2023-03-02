import { jolokiaService } from '@hawtiosrc/plugins/connect/jolokia-service'
import { MBeanNode, MBeanTree, TreeProcessor } from '@hawtiosrc/plugins/shared'
import React from 'react'
import { jmxDomain } from './globals'
import { getIcon, IconNames } from './icons'
import { routesService } from './routes-service'

/**
 * Fetch the camel version and add it to the tree to avoid making a blocking call
 * elsewhere.
 */
async function retrieveCamelVersion(contextNode: MBeanNode | null) {
  if (!contextNode) return

  if (!contextNode.objectName) {
    contextNode.addProperty('version', 'Camel Version not available')
    return
  }

  const camelVersion = await jolokiaService.readAttribute(contextNode.objectName, 'CamelVersion')
  contextNode.addProperty('version', camelVersion as string)
}

function adoptChild(parent: MBeanNode | null, child: MBeanNode | null, type: string, childIcon: React.ReactNode) {
  if (!parent || !child) return

  parent.adopt(child)
  child.setIcons(childIcon)
  child.addProperty('type', type)
}

function setChildIcon(node: MBeanNode | null, childIcon: React.ReactNode) {
  if (!node) return

  node.getChildren().forEach(child => {
    child.setIcons(childIcon)
  })
}

export const camelTreeProcessor: TreeProcessor = async (tree: MBeanTree) => {
  const domainNode = tree.get(jmxDomain)
  if (!domainNode) {
    return
  }

  domainNode.icon = getIcon(IconNames.CamelIcon)
  domainNode.expandedIcon = domainNode.icon

  // Detach current children from domain node
  const contexts = domainNode.removeChildren()

  // Create the initial contexts group node
  const groupNode = domainNode.getOrCreate('Camel Contexts', true)
  groupNode.icon = getIcon(IconNames.CamelIcon)
  groupNode.expandedIcon = domainNode.icon
  groupNode.addProperty('class', 'org-apache-camel-context-folder')
  groupNode.addProperty('type', 'context')
  groupNode.addProperty('key', 'camelContexts')

  contexts.forEach((context: MBeanNode) => {
    const contextCategory = context.get('context')
    let newCtxNode: MBeanNode | null = null
    if (contextCategory && contextCategory.childCount() === 1) {
      newCtxNode = contextCategory.getIndex(0)
    }

    if (!newCtxNode) return

    // Stash the camel version as a separate property
    retrieveCamelVersion(newCtxNode)

    const endPointFolderIcon = getIcon(IconNames.EndpointsFolderIcon)
    const endPointIcon = getIcon(IconNames.EndpointsNodeIcon)
    const routeIcon = getIcon(IconNames.CamelRouteIcon)

    const routesNode = context.get('routes')
    adoptChild(newCtxNode, routesNode, 'routes', endPointFolderIcon)
    setChildIcon(routesNode, routeIcon)

    routesService.transformXml(newCtxNode, routesNode)

    const endpointsNode = context.get('endpoints')
    adoptChild(newCtxNode, endpointsNode, 'endpoints', endPointFolderIcon)
    setChildIcon(endpointsNode, endPointIcon)

    const componentsNode = context.get('components')
    adoptChild(newCtxNode, componentsNode, 'components', endPointFolderIcon)
    setChildIcon(componentsNode, endPointIcon)

    const dataFormatsNode = context.get('dataformats')
    adoptChild(newCtxNode, dataFormatsNode, 'dataformats', endPointFolderIcon)

    //
    // Add all other entries which are not one of
    // context/routes/endpoints/components/dataformats as MBeans
    //
    const mBeansNode = (newCtxNode as MBeanNode).getOrCreate('~MBeans', true)
    context
      .getChildren()
      .filter(
        child =>
          !(
            child.name === 'context' ||
            child.name === 'routes' ||
            child.name === 'endpoints' ||
            child.name === 'components' ||
            child.name === 'dataformats'
          ),
      )
      .forEach(child => mBeansNode.adopt(child))

    mBeansNode.sort(false)

    // Finally add the new context to the group of contexts node
    groupNode.adopt(newCtxNode)
  })
}
