import { userService } from '@hawtiosrc/auth'
import { importRemote, ImportRemoteOptions } from '@module-federation/utilities'
import React from 'react'
import { configManager, TaskState } from './config-manager'
import { eventService } from './event-service'
import { log } from './globals'

const DEFAULT_REMOTE_ENTRY_FILE = 'remoteEntry.js'
const DEFAULT_PLUGIN_ORDER = 100
const DEFAULT_PLUGIN_ENTRY = 'plugin'
const HAWTIO_DISABLE_THEME_LISTENER = 'hawtio.disableThemeListener'

export const PATTERNFLY_MAJOR_VERSION = process.env.PATTERNFLY_MAJOR_VERSION || '6'
const PATTERNFLY_THEME_CLASS = `pf-v${PATTERNFLY_MAJOR_VERSION}-theme-dark`

/**
 * Components to be added to the header navbar
 * Can define either a single component type or
 * a component with a universal property.
 *
 * By default, components will only be displayed
 * if the plugin UI is also visible. However, setting
 * universal to 'true' will ensure the component
 * remains displayed regardless of which plugin is
 * given focus.
 */
export interface UniversalHeaderItem {
  /**
   * The component that should be populated as
   * a dropdown item on the header bar.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>

  /**
   * Should components remain visible on header even when
   * the plugin is not being displayed.
   */
  universal: boolean
}

export type HeaderItem = React.ComponentType | UniversalHeaderItem

export function isUniversalHeaderItem(item: HeaderItem): item is UniversalHeaderItem {
  return 'component' in item && 'universal' in item && typeof item.universal === 'boolean'
}

/**
 * Type definition of the entry point for a Hawtio plugin. Such plugin (method) should use Hawtio API
 * to register plugin details with name, paths and components.
 *
 * This method is synchronous and should synchronously call one of the plugin registration methods:
 * * `addPlugin`: add `Plugin` object directly
 * * `addDeferredPlugin`: add a function returning a Promise resolving to a `Plugin` object
 * * `addUrl`: add a URL for an endpoint returning an array of `HawtioRemote` objects representing remote modules
 * loaded using Module Federation utilities
 */
export type HawtioPlugin = () => void

/**
 * Type definition of a fully remote _plugin_ (function) that is called by Hawtio using @module-federation/utilities.
 *
 * This method should be asynchronous and return a Promise (with any value), so Hawtio can await for its resolution.
 */
export type HawtioAsyncPlugin = () => Promise<unknown>

/**
 * Internal representation of a Hawtio plugin.
 */
export type Plugin = {
  /**
   * Mandatory, unique plugin identifier
   */
  id: string

  /**
   * Title to be displayed in left PageSidebar
   */
  title?: string

  /**
   * Path for plugin's main component. Optional if the plugin only contributes header elements for example
   */
  path?: string

  /**
   * The order to be shown in the Hawtio sidebar.
   *
   * This only controls presentation and doesn't change the order of plugin to
   * be loaded.
   *
   * If it's not specified, it defaults to `100`. `0` ~ `30` are reserved for
   * the builtin plugins.
   */
  order?: number

  /**
   * If this plugin provides a login form component
   */
  isLogin?: boolean

  /**
   * Plugin's main component to be displayed inside `<HawtioPage>`
   */
  component?: React.ComponentType

  /**
   * Plugin's components to be added to `<HawtioHeaderToolbar>`
   */
  headerItems?: HeaderItem[]

  /**
   * Returns if this plugin should be activated.
   * This method needs to return a promise as the process of resolving if a plugin
   * should be activated may require information collected asynchronously such as
   * the existence of some MBeans, etc.
   */
  isActive: () => Promise<boolean>
}

/**
 * A collection of internal Hawtio plugins with IDs as keys.
 */
type Plugins = Record<string, Plugin>

/**
 * A collection of asynchronous functions returning Hawtio plugins
 */
type DeferredPlugins = Record<string, () => Promise<Plugin | Plugin[]>>

/**
 * Extension of Module Federation {@link ImportRemoteOptions} for single federated module.
 */
export interface HawtioRemote extends ImportRemoteOptions {
  pluginEntry?: string
}

/**
 * Interface through which `HawtioCore` should be available when importing it through `@hawtio/core/init` entry point.
 *
 * All the public methods of the implementing class will be available to other parts of `@hawtio/react`, but when
 * accessed through `IHawtio`, only part of the public API will be available.
 */
export interface IHawtio {
  /**
   * Adds a Hawtio plugin directly using `Plugin` object. The plugin will be added to a list of plugins processed
   * at bootstrap time
   * @param plugin
   */
  addPlugin(plugin: Plugin): IHawtio

  /**
   * Adds a Hawtio plugin in a deferred way. Instead of passing `Plugin` object directly, we pass a function that
   * returns a Promise resolving (for example after `import()`) to actual `Plugin` or an array of `Plugin` objects.
   * @param id Plugin ID
   * @param deferred a function returning a Promise resolving to a `Plugin` or array of `Plugin` objects
   */
  addDeferredPlugin(id: string, deferred: () => Promise<Plugin | Plugin[]>): IHawtio

  /**
   * Adds a URL for discovering plugins. Single URL defines an endpoint that returns an array of modules/plugins
   * defined by {@link HawtioRemote} type.
   *
   * @param url An URL to fetch the plugin information from. When the URL is relative, it is using
   * `document.baseURI` as the base.
   */
  addUrl(url: string): IHawtio

  /**
   * Bootstraps Hawtio. This method needs to be called by all applications that are bundled with `webpack` (or
   * similar web bundler).
   *
   * This method returns a Promise. When resolved we can finally render the `<Hawtio>` React/PatternFly component
   */
  bootstrap(): Promise<boolean>
}

/**
 * Hawtio core service.
 *
 * This service provides the following functionalities:
 * - Base path provisioning
 * - Plugin loader and discovery mechanism
 * - Bootstrapping the application
 */
export class HawtioCore implements IHawtio {
  /**
   * Hawtio base path.
   */
  private basePath?: string

  /**
   * List of URLs that the plugin loader will try and discover plugins from.
   */
  private urls: string[] = []

  /**
   * Holds all of the Hawtio plugins that need to be bootstrapped.
   */
  private plugins: Plugins = {}

  /**
   * Holds all of the Hawtio plugins which will be evaluated in deferred way.
   */
  private deferredPlugins: DeferredPlugins = {}

  /**
   * The Window Theme Listener callback function
   */
  private windowThemeListener = () => {
    this.updateFromTheme()
  }

  /**
   * Flag set once the window theme listener has been added
   */
  private windowListenerAdded = false

  // --- External Public API (IHawtio)

  addPlugin(plugin: Plugin): HawtioCore {
    log.info('Add plugin:', plugin.id)
    configManager.initItem('Registering plugin: ' + plugin.id, TaskState.started, 'plugins')
    if (this.plugins[plugin.id]) {
      throw new Error(`Plugin "${plugin.id}" already exists`)
    }
    this.plugins[plugin.id] = plugin
    setTimeout(() => {
      configManager.initItem('Registering plugin: ' + plugin.id, TaskState.finished, 'plugins')
    }, 0)
    return this
  }

  addDeferredPlugin(id: string, deferred: () => Promise<Plugin | Plugin[]>): HawtioCore {
    log.info('Add deferred plugin:', id)
    configManager.initItem('Registering deferred plugin: ' + id, TaskState.started, 'plugins')
    if (this.deferredPlugins[id]) {
      throw new Error(`Deferred plugin "${id}" already exists`)
    }
    if (this.plugins[id]) {
      throw new Error(`Conflict registering a deferred plugin with id="${id}". Plugin already registered.`)
    }
    this.deferredPlugins[id] = deferred
    return this
  }

  addUrl(url: string): HawtioCore {
    if (URL.canParse(url)) {
      // assume it's absolute URL
    } else {
      // assume it's relative URL
      url = new URL(url, document.baseURI).href
    }
    log.info('Add URL:', url)
    this.urls.push(url)
    return this
  }

  async bootstrap(): Promise<boolean> {
    log.info('Bootstrapping Hawtio...')

    // Load configuration to be used by all other services (login service, jolokia service, session service,
    // user service, ...)
    await configManager.initialize()

    // Load plugins
    await this.loadPlugins()

    // Apply branding
    // Branding should be applied after loading plugins as plugins may customise hawtconfig.
    const brandingApplied = await configManager.applyBranding()
    log.info('Branding applied:', brandingApplied)

    log.info('Bootstrapped Hawtio')
    configManager.initItem('Finish', TaskState.finished, 'finish')

    // return a promise that waits for configManager to finish all its initialization items
    return configManager.ready().then(() => {
      log.debug('configManager.ready() resolved')
      return true
    })
  }

  // --- Public API

  /**
   * Returns all plugins registered using different plugin registration methods.
   */
  getPlugins(): Plugin[] {
    return Object.values(this.plugins)
  }

  /**
   * Resolves which of registered plugins are active in current environment.
   *
   * There are two types of plugins: normal plugins and login plugins.
   * If it's normal, it's only resolved when the user is already logged in.
   * If it's login, it's only resolved when the user is not logged in yet, and thus
   * can only affects the login page.
   *
   * Therefore, this method depends on the login status provided by the `userService`.
   */
  async resolvePlugins(): Promise<Plugin[]> {
    const userLoggedIn = await userService.isLogin()

    log.debug('Resolve plugins: login =', userLoggedIn)

    const resolved: Plugin[] = []
    // load plugins sequentially to maintain the order
    for (const plugin of this.getPlugins()) {
      log.debug('Resolve plugin:', plugin.id)

      if ((userLoggedIn && plugin.isLogin) || (!userLoggedIn && !plugin.isLogin)) {
        continue
      }

      if (await plugin.isActive()) {
        resolved.push(plugin)
      }
    }

    log.debug('Resolved plugins:', resolved)

    // Sort plugins for presentation
    resolved.sort((a, b) => (a.order ?? DEFAULT_PLUGIN_ORDER) - (b.order ?? DEFAULT_PLUGIN_ORDER))

    return resolved
  }

  /**
   * Sets the base path of the Hawtio console.
   * If the given path includes trailing '/', it will be trimmed.
   */
  setBasePath(path: string) {
    if (path.length > 1 && path.endsWith('/')) {
      // Remove trailing '/'
      this.basePath = path.slice(0, -1)
    } else {
      this.basePath = path
    }
  }

  /**
   * Returns the base path of the Hawtio console without trailing '/'.
   */
  getBasePath(): string | undefined {
    if (!this.basePath) {
      const basePath = this.documentBase()
      log.info('Base path from html head:', basePath)
      if (basePath && basePath.length > 1 && basePath.endsWith('/')) {
        // Remove trailing '/'
        this.basePath = basePath.slice(0, -1)
      } else {
        this.basePath = basePath
      }
    }
    return this.basePath
  }

  /**
   * Adds an event listener to the window theme to update
   * css values in the event of a change in theme
   */
  addWindowThemeListener() {
    if (this.windowListenerAdded) {
      // Avoid checking storage an trying to re-add if already added
      return
    }

    const disableListener = localStorage.getItem(HAWTIO_DISABLE_THEME_LISTENER) ?? 'false'
    if (disableListener === 'true') {
      return // Do not enable theme listener
    }

    // Initial update when application is loaded
    this.updateFromTheme()

    // Subsequent attempts to change the theme
    this.themeList().addEventListener('change', this.windowThemeListener)
    this.windowListenerAdded = true
  }

  /**
   * Removes the event listener to the window theme
   */
  removeWindowThemeListener() {
    this.themeList().removeEventListener('change', this.windowThemeListener)
    this.windowListenerAdded = false
  }

  // --- private methods

  /**
   * Returns the base URL specified in html/head/base element, href attribute. It should end with trailing '/'.
   * Specified base affects how `fetch()` global function works.
   * @private
   */
  private documentBase(): string | undefined {
    const base = document.querySelector('head base')
    if (base) {
      return base.getAttribute('href') ?? undefined
    }
    return undefined
  }

  /**
   * Downloads plugins from any configured URLs and loads them.
   * It is invoked at Hawtio's bootstrapping.
   *
   * This plugin mechanism is implemented using [Webpack Module Federation](https://module-federation.github.io/).
   */
  private async loadPlugins() {
    if (this.urls.length === 0 && Object.entries(this.deferredPlugins).length === 0) {
      log.info('No URLs provided to load external plugins and no deferred plugins registered')
      return
    }

    const numBefore = Object.keys(this.plugins).length
    log.info(numBefore, 'plugins before loading:', { ...this.plugins })

    // Load external plugins from all URLs
    await Promise.all(this.urls.map(this.loadExternalPlugins))

    // Load deferred plugins - only now, because some external plugins may
    // have registered additional deferred plugins
    configManager.initItem('Loading deferred plugins', TaskState.started, 'plugins')
    await this.loadDeferredPlugins()
    configManager.initItem('Loading deferred plugins', TaskState.finished, 'plugins')

    const numAfter = Object.keys(this.plugins).length
    log.info(numAfter, 'plugins after loaded:', this.plugins)

    // Notify plugins update
    if (numBefore !== numAfter) {
      log.debug('Notify plugins update')
      eventService.pluginsUpdated()
    }
  }

  /**
   * Loads external plugins from the given URL. The URL endpoint is expected to
   * return an array of HawtioRemote objects. These are not strictly "Hawtio plugins", but rather
   * "remote entry points" that when called may register Hawtio plugins (with `hawtio.addPlugin()` or
   * `hawtio.addDeferredPlugin()`).
   */
  private async loadExternalPlugins(url: string) {
    log.debug('Trying url:', url)
    try {
      configManager.initItem('Loading plugins descriptor from URL ' + url, TaskState.started, 'plugins')
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status == 401 || res.status == 403) {
          configManager.initItem('Loading plugins descriptor from URL ' + url, TaskState.error, 'plugins')
          log.error('Failed to fetch url:', url, '-', res.status, res.statusText)
        } else {
          configManager.initItem('Loading plugins descriptor from URL ' + url, TaskState.skipped, 'plugins')
          log.warn('Failed to fetch url:', url, '-', res.status, res.statusText)
        }
        return
      }

      const remotes = (await res.json()) as HawtioRemote[]
      log.info('Loaded remotes from url:', url, '=', remotes)
      configManager.initItem('Loading plugins descriptor from URL ' + url, TaskState.finished, 'plugins')

      // Load plugins - map all remote plugin descriptions and add them to Promise.all - Hawtio will await
      // for all promises representing remote entry points
      return Promise.all(
        remotes.map(async remote => {
          let url: string
          if (typeof remote.url === 'function') {
            url = await remote.url()
          } else {
            url = remote.url
          }
          if (!url.endsWith('/')) {
            url += '/'
          }
          if (URL.canParse(url)) {
            // should be absolute URL
            url += remote.remoteEntryFileName ?? DEFAULT_REMOTE_ENTRY_FILE
          } else {
            url = new URL(url + (remote.remoteEntryFileName ?? DEFAULT_REMOTE_ENTRY_FILE), document.baseURI).href
          }
          log.info('Loading remote', remote)
          try {
            configManager.initItem('Importing plugin from: ' + url, TaskState.started, 'plugins')
            // call @module-federation/utilities method which helps us to deal with
            // webpack's Module Federation (like container.init(__webpack_share_scopes__['default']) call)
            const plugin = await importRemote<{ [entry: string]: HawtioAsyncPlugin }>(remote)
            const entryFn = plugin[remote.pluginEntry || DEFAULT_PLUGIN_ENTRY]
            if (!entryFn) {
              configManager.initItem('Importing plugin from: ' + url, TaskState.skipped, 'plugins')
              log.info('Ignored remote', remote, '(no entry point available)')
              return Promise.resolve(true)
            } else {
              // we should be flexible when using a result of the entry point function. Well behaving plugins
              // (actually plugin entry point functions) should return a promise resolved after the remote plugin
              // function actually registers a Hawtio plugin.
              // If such entry point function doesn't return a promise, we can't be sure when hawtio.addPlugin()
              // will actually be called.
              // We generally expect the plugin to call addPlugin() or addDeferredPlugin(), but plugins may simply
              // alter the branding or customize login hooks.
              // We definitely won't expect this such entry point functions to return a Plugin object to be registered
              // by Hawtio.
              // That's why fully dynamic Module Federation plugins are a bit less flexible than plugins declared
              // in "remotes" field of ModuleFederationPlugin in Webpack configuration
              const result = entryFn()
              let resultPromise: Promise<unknown>
              if (result instanceof Promise) {
                resultPromise = result
              } else {
                resultPromise = Promise.resolve(result)
              }
              return resultPromise.then(() => {
                configManager.initItem('Importing plugin from: ' + url, TaskState.finished, 'plugins')
                log.info('Loaded remote', remote)
              })
            }
          } catch (err) {
            configManager.initItem('Importing plugin from: ' + url, TaskState.error, 'plugins')
            log.error('Error loading remote:', remote, '-', err)
            return Promise.resolve(false)
          }
        }),
      )
    } catch (err) {
      configManager.initItem('Loading plugins descriptor from URL ' + url, TaskState.skipped, 'plugins')
      log.warn('Error fetching url:', url, '-', err)
      return
    }
  }

  /**
   * Evaluate all deferred plugins, so they are added to `plugins` array of available plugins
   * @private
   */
  private async loadDeferredPlugins() {
    log.debug('Loading deferred plugins')

    // each "deferred plugin" is a function returning a Promise resolving to a Plugin or an array of Plugin objects
    return Promise.all(
      Object.entries(this.deferredPlugins).map(async e => {
        const [id, deferred] = e

        // call the async method returning Promise<Plugin>
        return deferred()
          .then(result => {
            let plugins: Plugin[]
            if (!Array.isArray(result)) {
              plugins = [result]
            } else {
              plugins = result
            }
            for (const plugin of plugins) {
              // now we can treat it as direct plugin
              if (this.plugins[plugin.id]) {
                throw new Error(`Plugin "${plugin.id}" already exists`)
              }
              this.plugins[plugin.id] = plugin
            }

            // when deferred plugin was registered, we started dedicated initialization task. We can finish it now.
            configManager.initItem('Registering deferred plugin: ' + id, TaskState.finished, 'plugins')
          })
          .catch(err => {
            log.error('Error registering deferred plugin:', id, '-', err)
            configManager.initItem('Registering deferred plugin: ' + id, TaskState.error, 'plugins')
          })
      }),
    )
  }

  // Actual window theme query
  private themeList() {
    return window.matchMedia('(prefers-color-scheme: dark)')
  }

  /**
   * Detect what theme the browser has been set to and
   * return 'dark' | 'light'
   */
  private windowTheme(): string {
    return this.themeList().matches ? 'dark' : 'light'
  }

  /**
   * Update the document root with the PatternFly dark class
   * see https://www.patternfly.org/developer-resources/dark-theme-handbook
   */
  private updateFromTheme() {
    if (this.windowTheme() === 'dark') {
      log.debug(`Adding patternfly theme class: ${PATTERNFLY_THEME_CLASS} to document element`)
      document.documentElement.classList.add(PATTERNFLY_THEME_CLASS)
    } else {
      log.debug(`Removing patternfly theme class: ${PATTERNFLY_THEME_CLASS} to document element`)
      document.documentElement.classList.remove(PATTERNFLY_THEME_CLASS)
    }
  }
}

export const hawtio = new HawtioCore()
