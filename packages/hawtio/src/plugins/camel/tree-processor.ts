import { MBeanNode, MBeanTree, TreeProcessor } from '@hawtiosrc/plugins/shared/tree'
import { ReactNode } from 'react'
import * as camelService from './camel-service'
import {
  camelContexts,
  componentNodeType,
  componentsType,
  contextNodeType,
  contextsType,
  dataformatsType,
  defaultRouteGroupsType,
  domainNodeType,
  endpointNodeType,
  endpointsType,
  jmxDomain,
  mbeansType,
  routeGroupsType,
  routeNodeType,
  routesType,
} from './globals'
import { IconNames, getIcon } from './icons'
import { routeStatsService } from './route-stats-service'

function adoptChild(parent: MBeanNode, child: MBeanNode, type: string, childIcon: ReactNode) {
  parent.adopt(child)
  child.setIcons(childIcon)
  if (camelService.isContext(parent)) {
    child.addMetadata(contextNodeType, parent.objectName ?? '')
  }
  child.setType(type)
  camelService.setDomain(child)
}

function setChildIcon(node: MBeanNode, childIcon: ReactNode) {
  node.getChildren().forEach(child => {
    child.setIcons(childIcon)
  })
}

function groupRoutes(routesNode: MBeanNode) {
  let haveGroups = false
  for (const routeNode of routesNode.getChildren()) {
    const groupId = routeNode.getMetadata('group')
    if (groupId) {
      haveGroups = true
      break
    }
  }

  if (!haveGroups) return // Nothing to do - leave routes as not being grouped

  const routeIcon = getIcon(IconNames.CamelRouteIcon)
  const routeNodes = [...routesNode.getChildren()]

  for (const routeNode of routeNodes) {
    if (routeNode.getType() === routeGroupsType) continue

    const groupId = routeNode.getMetadata('group')
    let groupNode: MBeanNode
    if (groupId) {
      groupNode = routesNode.getOrCreate(groupId, true)
    } else {
      groupNode = routesNode.getOrCreate(defaultRouteGroupsType, true)
    }

    groupNode.setType(routeGroupsType)
    camelService.setDomain(groupNode)

    adoptChild(groupNode, routeNode, routeNodeType, routeIcon)
  }

  setChildIcon(routesNode, routeIcon)
}

export const camelTreeProcessor: TreeProcessor = async (tree: MBeanTree) => {
  const camelDomain = tree.get(jmxDomain)
  if (!camelDomain) {
    return
  }

  camelDomain.setIcons(getIcon(IconNames.CamelIcon))
  camelDomain.setType(domainNodeType)
  camelService.setDomain(camelDomain)

  // Detach current children from domain node
  const oldContexts = camelDomain.removeChildren()

  // Create the initial contexts group node
  const groupCtxsNode = camelDomain.getOrCreate(camelContexts, true)
  groupCtxsNode.setIcons(getIcon(IconNames.CamelIcon))
  groupCtxsNode.addMetadata('class', 'org-apache-camel-context-folder')
  groupCtxsNode.addMetadata('key', camelContexts)
  groupCtxsNode.addMetadata('name', camelContexts)
  groupCtxsNode.addMetadata('id', 'camel-contexts')
  groupCtxsNode.setType(contextsType)
  camelService.setDomain(groupCtxsNode)

  for (const context of oldContexts) {
    const contextCategory = context.get(contextNodeType, true)
    let newCtxNode: MBeanNode | null = null
    if (contextCategory && contextCategory.childCount() === 1) {
      newCtxNode = contextCategory.getIndex(0)
    }

    if (!newCtxNode) return

    newCtxNode.setType(contextNodeType)
    camelService.setDomain(newCtxNode)
    // Set the camel version as a property on the context
    await camelService.fetchCamelVersion(newCtxNode)
    newCtxNode.setIcons(getIcon(IconNames.CamelIcon))

    const endpointsFolderIcon = getIcon(IconNames.EndpointsFolderIcon)
    const endpointsIcon = getIcon(IconNames.EndpointsNodeIcon)
    const routeIcon = getIcon(IconNames.CamelRouteIcon)

    const routesNode = context.get(routesType, true)
    if (routesNode) {
      adoptChild(newCtxNode, routesNode, routesType, endpointsFolderIcon)
      setChildIcon(routesNode, routeIcon)
      camelService.setChildProperties(routesNode, routeNodeType)
      routesNode.addMetadata(contextNodeType, newCtxNode.objectName ?? '')

      await routeStatsService.loadRoutesXml(newCtxNode, routesNode)

      // Once XML has been processed then group the routes if they have groupIds
      groupRoutes(routesNode)
    }

    const endpointsNode = context.get(endpointsType, true)
    if (endpointsNode) {
      adoptChild(newCtxNode, endpointsNode, endpointsType, endpointsFolderIcon)
      setChildIcon(endpointsNode, endpointsIcon)
      camelService.setChildProperties(endpointsNode, endpointNodeType)
    }

    const componentsNode = context.get(componentsType, true)
    if (componentsNode) {
      adoptChild(newCtxNode, componentsNode, componentsType, endpointsFolderIcon)
      setChildIcon(componentsNode, endpointsIcon)
      camelService.setChildProperties(componentsNode, componentNodeType)
    }

    const dataFormatsNode = context.get(dataformatsType, true)
    if (dataFormatsNode) {
      adoptChild(newCtxNode, dataFormatsNode, dataformatsType, endpointsFolderIcon)
    }

    //
    // Add all other entries which are not one of
    // context/routes/endpoints/components/dataformats as MBeans
    //
    const mBeansNode = newCtxNode.getOrCreate(mbeansType, true)
    mBeansNode.setType(mbeansType)
    camelService.setDomain(mBeansNode)

    const predefinedTypes = new Set([contextNodeType, routesType, endpointsType, componentsType, dataformatsType])
    context
      .getChildren()
      .filter(child => !predefinedTypes.has(child.name))
      .forEach(child => mBeansNode.adopt(child))

    mBeansNode.sort(false)

    // Finally add the new context to the group of contexts node
    groupCtxsNode.adopt(newCtxNode)
    // Reinitialise HTML ids for the new Camel tree
    groupCtxsNode.initId(true)
  }
}
