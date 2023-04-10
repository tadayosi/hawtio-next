import { configManager } from './core'

export * from './core'
export * from './Hawtio'
export { helpRegistry } from './help'
export { preferencesRegistry } from './preferences'

// Register Hawtio React component version
configManager.addProductInfo('Hawtio React', '__PACKAGE_VERSION_PLACEHOLDER__')
