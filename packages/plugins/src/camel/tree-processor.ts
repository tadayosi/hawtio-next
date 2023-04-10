import { MBeanNode, MBeanTree, TreeProcessor } from '__root__/shared/tree'
import React from 'react'
import * as ccs from './camel-content-service'
import {
  jmxDomain,
  camelContexts,
  contextsType,
  contextNodeType,
  routesType,
  endpointsType,
  endpointNodeType,
  componentsType,
  componentNodeType,
  dataformatsType,
  domainNodeType,
  mbeansType,
  routeNodeType,
} from './globals'
import { getIcon, IconNames } from './icons'
import { routesService } from './routes-service'

function adoptChild(parent: MBeanNode | null, child: MBeanNode | null, type: string, childIcon: React.ReactNode) {
  if (!parent || !child) return

  parent.adopt(child)
  child.setIcons(childIcon)
  ccs.setType(child, type)
  ccs.setDomain(child)
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
  ccs.setType(domainNode, domainNodeType)

  // Detach current children from domain node
  const oldContexts = domainNode.removeChildren()

  // Create the initial contexts group node
  const groupCtxsNode = domainNode.getOrCreate(camelContexts, true)
  groupCtxsNode.icon = getIcon(IconNames.CamelIcon)
  groupCtxsNode.expandedIcon = domainNode.icon
  groupCtxsNode.addProperty('class', 'org-apache-camel-context-folder')
  groupCtxsNode.addProperty('key', camelContexts)
  groupCtxsNode.addProperty('name', camelContexts)
  ccs.setType(groupCtxsNode, contextsType)
  ccs.setDomain(groupCtxsNode)

  oldContexts.forEach((context: MBeanNode) => {
    const contextCategory = context.get(contextNodeType)
    let newCtxNode: MBeanNode | null = null
    if (contextCategory && contextCategory.childCount() === 1) {
      newCtxNode = contextCategory.getIndex(0)
    }

    if (!newCtxNode) return

    ccs.setType(newCtxNode, contextNodeType)
    ccs.setDomain(newCtxNode)
    // Set the camel version as a property on the context
    ccs.setCamelVersion(newCtxNode)

    const endPointFolderIcon = getIcon(IconNames.EndpointsFolderIcon)
    const endPointIcon = getIcon(IconNames.EndpointsNodeIcon)
    const routeIcon = getIcon(IconNames.CamelRouteIcon)

    const routesNode = context.get(routesType)
    adoptChild(newCtxNode, routesNode, routesType, endPointFolderIcon)
    setChildIcon(routesNode, routeIcon)
    ccs.setChildProperties(routesNode, routeNodeType)
    routesService.transformXml(newCtxNode, routesNode)

    const endpointsNode = context.get(endpointsType)
    adoptChild(newCtxNode, endpointsNode, endpointsType, endPointFolderIcon)
    setChildIcon(endpointsNode, endPointIcon)
    ccs.setChildProperties(endpointsNode, endpointNodeType)

    const componentsNode = context.get(componentsType)
    adoptChild(newCtxNode, componentsNode, componentsType, endPointFolderIcon)
    setChildIcon(componentsNode, endPointIcon)
    ccs.setChildProperties(componentsNode, componentNodeType)

    const dataFormatsNode = context.get(dataformatsType)
    adoptChild(newCtxNode, dataFormatsNode, dataformatsType, endPointFolderIcon)

    //
    // Add all other entries which are not one of
    // context/routes/endpoints/components/dataformats as MBeans
    //
    const mBeansNode = (newCtxNode as MBeanNode).getOrCreate(mbeansType, true)
    ccs.setType(mBeansNode, mbeansType)
    ccs.setDomain(mBeansNode)

    context
      .getChildren()
      .filter(
        child =>
          !(
            child.name === contextNodeType ||
            child.name === routesType ||
            child.name === endpointsType ||
            child.name === componentsType ||
            child.name === dataformatsType
          ),
      )
      .forEach(child => mBeansNode.adopt(child))

    mBeansNode.sort(false)

    // Finally add the new context to the group of contexts node
    groupCtxsNode.adopt(newCtxNode)
  })
}
