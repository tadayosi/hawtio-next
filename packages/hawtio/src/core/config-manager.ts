import { PATH_LOGIN, PATH_LOGOUT } from '@hawtiosrc/auth/globals'
import { type Plugin } from './core'
import { Logger } from './logging'

const log = Logger.get('hawtio-core-config')

export const DEFAULT_APP_NAME = 'Hawtio Management Console'
export const DEFAULT_LOGIN_TITLE = 'Log in to your account'
export const HAWTCONFIG_JSON = 'hawtconfig.json'

/**
 * The single user-customisable entrypoint for the Hawtio console configurations.
 */
export type Hawtconfig = {
  /**
   * Configuration for branding & styles.
   */
  branding?: BrandingConfig

  /**
   * Configuration for the placement and structure of the UI
   */
  appearance?: AppearanceConfig

  /**
   * Configuration for the built-in login page.
   */
  login?: LoginConfig

  /**
   * Configuration for the About modal.
   */
  about?: AboutConfig

  /**
   * The user can explicitly disable plugins by specifying the plugin route paths.
   *
   * This option can be used if some of the built-in plugins are not desirable
   * for the custom installation of Hawtio console.
   */
  disabledRoutes?: DisabledRoutes

  /**
   * Configuration for JMX plugin.
   */
  jmx?: JmxConfig

  /**
   * Configuration for Hawtio Online.
   */
  online?: OnlineConfig
}

/**
 * Branding configuration type.
 */
export type BrandingConfig = {
  appName?: string
  showAppName?: boolean
  appLogoUrl?: string
  appLogoDarkModeUrl?: string
  css?: string
  favicon?: string
}

/**
 * Appearance configuration type.
 */
export type AppearanceConfig = {
  /**
   * Whether to display the header bar (default: true)
   */
  showHeader?: boolean

  /**
   * Whether to display the brand logo on the header bar (default: true)
   */
  showBrand?: boolean

  /**
   * Whether to display the user header dropdown on the header bar (default: true)
   */
  showUserHeader?: boolean

  /**
   * Whether to display the sidebar (default: true)
   */
  showSideBar?: boolean
}

/**
 * Login configuration type.
 */
export type LoginConfig = {
  title?: string
  description?: string
  links?: LoginLink[]
}

/**
 * Configuration of a single link at the login page
 */
export type LoginLink = {
  url: string
  text: string
}

/**
 * About configuration type.
 */
export type AboutConfig = {
  title?: string
  description?: string
  imgSrc?: string
  imgDarkModeSrc?: string
  backgroundImgSrc?: string
  backgroundDarkModeImgSrc?: string
  productInfo?: AboutProductInfo[]
  copyright?: string
  /**
   * Configuration for the "Report issue" entry in the Help menu.
   * When set, a "Report issue" item is added to the Help dropdown that opens
   * the given URL in a new browser tab.
   */
  issueReporting?: IssueReportingConfig
}

/**
 * Information about single _product_ or _component_ added to Hawtio application
 */
export type AboutProductInfo = {
  name: string
  value: string
}

/**
 * Configuration for the "Report issue" Help menu entry.
 */
export type IssueReportingConfig = {
  /**
   * The URL to open when the user clicks "Report issue".
   */
  url: string
  /**
   * The label shown in the Help menu. Defaults to "Report issue".
   */
  label?: string
}

/**
 * List of routes which should be disabled in a Hawtio application
 */
export type DisabledRoutes = string[]

/**
 * JMX configuration type.
 */
export type JmxConfig = {
  /**
   * This option can either disable workspace completely by setting `false`, or
   * specify an array of MBean paths in the form of
   * `<domain>/<prop1>=<value1>,<prop2>=<value2>,...`
   * to fine-tune which MBeans to load into workspace.
   *
   * Note that disabling workspace should also deactivate all the plugins that
   * depend on MBeans provided by workspace.
   *
   * @see https://github.com/hawtio/hawtio-react/issues/421
   */
  workspace?: boolean | string[]
}

/**
 * Hawtio Online configuration type.
 */
export type OnlineConfig = {
  /**
   * Selector for OpenShift projects or Kubernetes namespaces.
   *
   * @see https://github.com/hawtio/hawtio-online/issues/64
   */
  projectSelector?: string
}

/**
 * Stages of initialization tasks performed by Hawtio and presented in `<HawtioInitialization>` component
 */
export enum TaskState {
  started,
  skipped,
  finished,
  error,
}

/**
 * A structure to hold information about initialization tasks performed by Hawtio
 */
export type InitializationTasks = Record<string, { ready: TaskState; group: string }>

/**
 * Supported authentication methods
 */
export type AuthenticationKind =
  /**
   * Basic authentication - requires preparation of `Authorization: Basic <base64(user:password)>` HTTP header
   */
  | 'basic'

  /**
   * External authentication - triggered even before navigating to Hawtio, so can't really be handled
   */
  | 'external'

  /**
   * Digest authentication - [Digest Access Authentication Scheme](https://www.rfc-editor.org/rfc/rfc2617#section-3),
   * uses several challenge parameters (realm, nonces, ...)
   */
  | 'digest'

  /**
   * Form authentication - we need to know the URI to send the credentials to. It may be
   * `application/x-www-form-urlencoded` content (then we need to know the fields to use) or JSON with some schema.
   */
  | 'form'

  /**
   * This may be tricky, because we can't control it at JavaScript level...
   */
  | 'clientcert'

  /**
   * This is universal OpenID connect login type, so we need some information - should be configured
   * using `.well-known/openid-configuration` endpoint, but with additional parameters (to choose supported values
   * for some operations).
   */
  | 'oidc'

  /**
   * _Native_ Keycloak authentication using `keycloak.js` library
   */
  | 'keycloak'

  /**
   * Probably less standardized than `.well-known/openid-configuration`, but similar. We need to know the endpoints
   * to use for OAuth2 auth.
   */
  | 'oauth2'

/**
 * State of authentication result which is used at login screen to show specific error message
 */
export enum AuthenticationResult {
  /** successful authentication */
  ok,
  /** error due to initial configuration of the plugin */
  configuration_error,
  /** error due to communication error with IdP (for OIDC) */
  connect_error,
  /** error due to `window.isSecureContext` */
  security_context_error,
}

/**
 * Base type for authentication methods supported by Hawtio
 */
export type AuthenticationMethod = {
  /** One of the supported methods. If a plugin augments given method, we should have one such method only or matching `position` */
  method: AuthenticationKind
  /** If there are more methods of the same kind, we need a position field to distinguish them */
  position?: number
  /** Name to be presented at login page for login method selection */
  name?: string
  /** Plugin specific method for performing login. For now it's for OAuth2/OIDC/Keycloak. This field is set up by auth plugin */
  login?: () => Promise<AuthenticationResult>
}

/**
 * Configuration of Basic Authentication
 */
export type BasicAuthenticationMethod = AuthenticationMethod & {
  /** Basic Authentication Realm - not sent with `Authorization`, but user should see it */
  realm: string
}

/**
 * Configuration of FORM-based login configuration
 */
export type FormAuthenticationMethod = AuthenticationMethod & {
  /** POST URL to send the credentials to */
  url: string | URL

  /** POST URL for logout endpoint */
  logoutUrl: string | URL

  /**
   * `application/x-www-form-urlencoded` or `application/json`. For JSON it's just object with two configurable fields
   */
  type: 'form' | 'json'

  /**
   * Field name for user name
   */
  userField: string

  /**
   * Field name for password
   * TODO: possibly encoded/encrypted?
   */
  passwordField: string
}

/**
 * OpenID Connect authentication method configuration.
 * All details are specified in a type defined in OIDC plugin, but here we may define some generic fields
 */
export type OidcAuthenticationMethod = AuthenticationMethod & {}

/**
 * Interface through which `ConfigManager` should be available when importing it through `@hawtio/core/init` entry point.
 *
 * We should keep public methods of the implementing class available to other parts of `@hawtio/react`,
 * but other NPM packages which use `@hawtio/react` should rather import `init` entry point and get access to
 * a subset of available methods.
 */
export interface IConfigManager {
  /**
   * Add information about product that builds on `@hawtio/react`. It may be full application or part of the
   * application
   *
   * @param name Name of the component
   * @param value Value to show for the component name - usually a version
   */
  addProductInfo(name: string, value: string): Promise<void>

  /**
   * Track initialization task at selected {@link TaskState}. For proper usage, all tasks should first be
   * registered with `started` and finally with one of:
   *  * `finished`
   *  * `skipped`
   *  * `error`
   *
   * @param item Initialization task name
   * @param state Initialization task state
   * @param group One of supported initialization task groups
   */
  initItem(item: string, state: TaskState, group: 'config' | 'plugins' | 'finish'): void

  /**
   * Returns global log level value set for the "root logger". Defaults to INFO value.
   */
  globalLogLevel(): number
}

/**
 * This class provides API for configuration of `@hawtio/react` package
 */
export class ConfigManager implements IConfigManager {
  /** Configuration object read from `hawtconfig.json` and/or built programmatically */
  private config?: Promise<Hawtconfig>

  /** List of initialization tasks to be presented in `<HawtioInitialization>` component */
  private initTasks: InitializationTasks = {}

  /** Listeners notified about initialization task state changes */
  private initListeners: ((tasks: InitializationTasks) => void)[] = []

  /** Configuration of available authentication methods, used by login-related components */
  private authenticationConfig: AuthenticationMethod[] = []

  /** Resolution method for `authenticationConfigPromise` */
  private authenticationConfigReady: (ready: boolean | PromiseLike<boolean>) => void = () => true

  private authenticationConfigEndpointSupported = false

  /** Promise resolved when authentication config is already read from external source */
  private authenticationConfigPromise = new Promise<boolean>(resolve => {
    this.authenticationConfigReady = resolve
  })

  // --- External Public API (IConfigManager)

  async addProductInfo(name: string, value: string) {
    const config = await this.getHawtconfig()
    if (!config.about) {
      config.about = {}
    }
    if (!config.about.productInfo) {
      config.about.productInfo = []
    }
    config.about.productInfo.push({ name, value })
  }

  initItem(item: string, ready: TaskState, group: 'config' | 'plugins' | 'finish') {
    this.initTasks[item] = { ready, group }
    setTimeout(() => {
      for (const l of this.initListeners) {
        l(this.initTasks)
      }
    }, 0)
  }

  globalLogLevel(): number {
    return Logger.getLevel().value
  }

  // --- Public API

  /**
   * This method is called by `hawtio.bootstrap()`, so we have a single point where global (not plugin-specific)
   * configuration is loaded
   */
  async initialize(): Promise<boolean> {
    this.initItem('Checking authentication providers', TaskState.started, 'config')

    // default configuration which is handled by hawtio/hawtio using io.hawt.web.auth.LoginServlet
    const defaultConfiguration: FormAuthenticationMethod = {
      method: 'form',
      name: 'Form Authentication',
      url: PATH_LOGIN,
      logoutUrl: PATH_LOGOUT,
      type: 'json',
      userField: 'username',
      passwordField: 'password',
    }

    this.authenticationConfig = await fetch('auth/config/login')
      .then(response => {
        if (response.ok) {
          // the endpoint is fine - whatever it returns we trust it
          // if it returns empty array, we use default configuration
          this.authenticationConfigEndpointSupported = true
          return response.json()
        } else {
          // 404 means there's no such endpoint, so we may used older version of Hawtio
          // or a backend that doesn't implement this endpoint, we have to record this fact
          if (response.status === 404) {
            this.authenticationConfigEndpointSupported = false
          } else {
            // it can be 401 or 403, but anyway there's something there
            this.authenticationConfigEndpointSupported = true
          }
          return []
        }
      })
      .then((json: AuthenticationMethod[]) => {
        if (Array.isArray(json)) {
          return json.length == 0 ? [defaultConfiguration] : json
        } else {
          return [defaultConfiguration]
        }
      })
      .catch(e => {
        log.debug('Problem fetching authentication providers', e)
        return [defaultConfiguration]
      })
    const indexMap = new Map()
    this.authenticationConfig.forEach(m => {
      if (!m.position) {
        if (!indexMap.has(m.method)) {
          indexMap.set(m.method, 0)
        }
        const idx = indexMap.get(m.method)
        m.position = idx
        indexMap.set(m.method, idx + 1)
      }
    })

    // configuration is ready - resolve the promise. But plugins may still call
    // configureAuthenticationMethod() to alter the generic list of methods
    this.authenticationConfigReady(true)
    this.initItem('Checking authentication providers', TaskState.finished, 'config')

    return true
  }

  /**
   * Called by plugins to augment generic authentication method config.
   * Plugins may provide additional details, like location of OIDC provider.
   * @param config
   */
  async configureAuthenticationMethod(config: AuthenticationMethod): Promise<void> {
    // plugin-specific configuration can be applied to generic configuration from /auth/config/login
    // only when it's already fetched
    let found = false
    return this.authenticationConfigPromise.then(() => {
      // search generic login configurations and alter the one which matches passed `config` by `method` field
      for (const idx in this.authenticationConfig) {
        if (
          this.authenticationConfig[idx]?.method === config.method &&
          this.authenticationConfig[idx]?.position === config.position
        ) {
          // a plugin provides the remaining part of given authentication method (except the name)
          const name = this.authenticationConfig[idx].name
          this.authenticationConfig[idx] = {
            ...config,
            name,
          }
          found = true
          break
        }
      }
      if (!found) {
        // it means there's a plugin like keycloak or oidc but there's no such method discovered from /auth/config/login
        // endpoint - could be that this endpoint doesn't exist or is not implemented correctly
        // but there IS keycloak or oidc method, so we add it dynamically
        let name = config['name'] ?? config.method
        // just handling known methods
        if (name == 'oidc') {
          name = 'OpenID Connect'
        }
        if (name == 'keycloak') {
          name = 'Keycloak'
        }
        if (this.authenticationConfigEndpointSupported) {
          // we found an auth/config/login endpoint which returned some authentication methods, but not the one
          // passed here. So we _add_ this one
          this.authenticationConfig.push({ ...config, name })
        } else {
          // there's no auth/config/endpoint, so we may be using old Hawtio backend or a backend which
          // simply doesn't have this endpoint.
          // in this special case we simply don't use the default form login config and choose this one
          // (probably keycloak or OIDC)
          this.authenticationConfig = [{ ...config, name }]
        }
      }
    })
  }

  /**
   * Get configured authentication methods - possibly augmented by plugins. This method should
   * be called from hooks and React components, so can be done only after hawtio.bootstrap() promise is
   * resolved. This ensures that plugins already finished their configuration.
   */
  getAuthenticationConfig(): AuthenticationMethod[] {
    return this.authenticationConfig
  }

  /**
   * Returns selected authentication method by name
   * @param method
   * @param idx
   */
  getAuthenticationMethod(method: string, idx: number): AuthenticationMethod | undefined {
    return this.authenticationConfig.find(am => am.method === method && am.position === idx)
  }

  /**
   * Set new `Hawtconfig` object as the configuration
   * @param config
   */
  setHawtconfig(config: Hawtconfig) {
    this.config = Promise.resolve(config)
  }

  /**
   * Returns currently configured `Hawtconfig` object
   */
  async getHawtconfig(): Promise<Hawtconfig> {
    if (this.config) {
      return this.config
    }

    this.config = this.loadConfig()
    return this.config
  }

  /**
   * Resets current `Hawtconfig` object to undefined state
   */
  reset() {
    this.config = undefined
  }

  /**
   * Loads configuration from `hawtconfig.json`.
   * @private
   */
  private async loadConfig(): Promise<Hawtconfig> {
    log.info('Loading', HAWTCONFIG_JSON)

    this.initItem('Loading ' + HAWTCONFIG_JSON, TaskState.started, 'config')
    try {
      const res = await fetch(HAWTCONFIG_JSON)
      if (!res.ok) {
        log.error('Failed to fetch', HAWTCONFIG_JSON, '-', res.status, res.statusText)
        this.initItem('Loading ' + HAWTCONFIG_JSON, TaskState.skipped, 'config')
        return {}
      }

      const config = await res.json()
      log.debug(HAWTCONFIG_JSON, '=', config)
      log.info('Loaded', HAWTCONFIG_JSON)

      this.initItem('Loading ' + HAWTCONFIG_JSON, TaskState.finished, 'config')
      return config
    } catch (err) {
      log.error('Error fetching', HAWTCONFIG_JSON, '-', err)
      this.initItem('Loading ' + HAWTCONFIG_JSON, TaskState.skipped, 'config')
      return {}
    }
  }

  /**
   * Plugins may use this method to change parts, or entire `hawtconfig.json` configuration.
   * @param configurer
   */
  async configure(configurer: (config: Hawtconfig) => void) {
    const config = await this.getHawtconfig()
    configurer(config)
  }

  /**
   * Apply loaded configuration to application (titles, links, icons). Should be called during Hawtio bootstrap.
   */
  async applyBranding(): Promise<boolean> {
    this.initItem('Applying branding', TaskState.started, 'config')

    const { branding } = await this.getHawtconfig()
    if (!branding) {
      this.initItem('Applying branding', TaskState.skipped, 'config')
      return false
    }

    log.info('Apply branding', branding)
    let applied = false
    if (branding.appName) {
      log.info('Updating title -', branding.appName)
      document.title = branding.appName
      applied = true
    }
    if (branding.css) {
      // Branding css should be pushed to last to override the builtin PatternFly styles
      this.updateHref('#branding', branding.css, true)
      applied = true
    }
    if (branding.favicon) {
      this.updateHref('#favicon', branding.favicon)
      applied = true
    }

    this.initItem('Applying branding', applied ? TaskState.finished : TaskState.skipped, 'config')
    return applied
  }

  /**
   * Alters `href` attribute of selected DOM element (for icons, styles)
   * @param id
   * @param path
   * @param moveToLast
   * @private
   */
  private updateHref(id: string, path: string, moveToLast: boolean = false): void {
    log.info('Updating href for', id, '-', path, moveToLast)
    const elm = document.querySelector(id) as HTMLInputElement
    if (!elm) {
      return
    }
    if ('disabled' in elm) {
      elm.disabled = true
    }
    elm.setAttribute('href', path)
    if (moveToLast) {
      elm.remove()
      document.querySelector('head')?.append(elm)
    }
    if ('disabled' in elm) {
      elm.disabled = false
    }
  }

  async isRouteEnabled(path: string): Promise<boolean> {
    const { disabledRoutes } = await this.getHawtconfig()
    return !disabledRoutes || !disabledRoutes.includes(path)
  }

  /**
   * Filter loaded plugins, so only plugins which are not explicitly disabled in `hawtconfig.json` are used.
   * @param plugins
   */
  async filterEnabledPlugins(plugins: Plugin[]): Promise<Plugin[]> {
    // await the config only once - not for each of the checked plugins
    const { disabledRoutes } = await this.getHawtconfig()
    const enabledPlugins: Plugin[] = []
    for (const plugin of plugins) {
      if (
        (plugin.path == null && (await plugin.isActive())) ||
        !disabledRoutes ||
        !disabledRoutes.includes(plugin.path!)
      ) {
        enabledPlugins.push(plugin)
      } else {
        log.debug(`Plugin "${plugin.id}" disabled by hawtconfig.json`)
      }
    }
    return enabledPlugins
  }

  /**
   * Returns current state of initialization tasks
   */
  getInitializationTasks(): InitializationTasks {
    return this.initTasks
  }

  /**
   * Register a listener to be notified about state changes of initialization tasks
   * @param listener
   */
  addInitListener(listener: (tasks: InitializationTasks) => void) {
    this.initListeners.push(listener)
  }

  /**
   * Unregister previously registered listener for state changes of initialization tasks
   * @param listener
   */
  removeInitListener(listener: (tasks: InitializationTasks) => void) {
    this.initListeners.splice(this.initListeners.indexOf(listener), 1)
  }

  /**
   * Are all the initialization items completed? The returned promise will be asynchronously resolved when
   * initialization is finished.
   *
   * When the configuration is _ready_, Hawtio may proceed to rendering UI.
   */
  async ready(): Promise<boolean> {
    return new Promise((resolve, _reject) => {
      const h: NodeJS.Timeout = setInterval(() => {
        const result =
          Object.values(this.initTasks!).find(v => v.ready == TaskState.started || v.ready == TaskState.error) ==
          undefined
        if (result) {
          resolve(true)
          clearInterval(h)
        }
      }, 100)
    })
  }
}

export const configManager = new ConfigManager()
