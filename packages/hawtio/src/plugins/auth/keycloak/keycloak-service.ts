import { userService } from '@hawtiosrc/auth'
import { ResolveUser } from '@hawtiosrc/auth/user-service'
import { fetchPath } from '@hawtiosrc/util/fetch'
import { basicAuthHeaderValue, getCookie } from '@hawtiosrc/util/https'
import Keycloak, {
  type KeycloakConfig,
  type KeycloakInitOptions,
  KeycloakLoginOptions,
  type KeycloakPkceMethod,
  type KeycloakProfile,
} from 'keycloak-js'
import { PATH_KEYCLOAK_CLIENT_CONFIG, PATH_KEYCLOAK_ENABLED, PATH_KEYCLOAK_VALIDATE } from './globals'
import { AuthenticationResult, configManager, Logger, TaskState } from '@hawtiosrc/core'

const pluginName = 'hawtio-keycloak'
const AUTH_METHOD = 'keycloak'

const log = Logger.get(pluginName)

export type UserProfile = {
  token?: string
}

export type KeycloakUserProfile = UserProfile & KeycloakProfile

export type HawtioKeycloakConfig = KeycloakConfig & {
  /**
   * Hawtio custom option to instruct whether to use JAAS authentication or not.
   * When `true`, JWT token is sent as password with `Authorization: Basic base64(user:<token>)`
   * When `false`, the token is sent with `Authorization: Bearer <token>`
   * Default: `true`
   */
  jaas?: boolean

  /**
   * The method for Proof Key Code Exchange (PKCE) to use.
   * Configuring this value enables the PKCE mechanism. Available options:
   * - "S256" - The SHA256 based PKCE method
   */
  pkceMethod?: KeycloakPkceMethod

  /**
   * URI to be sent by keycloak.js with `post_logout_redirect_uri` parameter - important for Spring Boot
   */
  logoutUri?: string
}

export const KEYCLOAK_TOKEN_MINIMUM_VALIDITY = 5 // 5 sec.

export interface IKeycloakService {
  isKeycloakEnabled(): Promise<boolean>
  registerUserHooks(helpRegistration: () => void): void
  validateSubjectMatches(user: string): Promise<boolean>
}

class KeycloakService implements IKeycloakService {
  // promises created during construction
  // configuration from Hawtio backend - should include provider URL and realm. defined in keycloak.js
  private readonly config: Promise<HawtioKeycloakConfig | null>
  // Keycloak is enabled when /keycloak/client-config endpoint returns `true`
  private readonly enabled: Promise<boolean>
  // Keycloak instance - from keycloak.js which performs all Keycloak interaction
  private readonly keycloak: Promise<Keycloak | null>

  // promise related to logged-in user. Contains JWT access_token from Keycloak and information about
  // user from id_token.
  private readonly userProfile: Promise<KeycloakUserProfile | null>

  // when user is logged in, the credentials are represented by the token (usually JWT), which has to
  // be sent with every HTTP request using built-in fetch, which we wrap
  private readonly originalFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

  constructor() {
    // is keycloak enabled at server side? (/keycloak/enabled endpoint)
    this.enabled = this.loadKeycloakEnabled()
    // Keycloak configuration to be passed to Keycloak instance (/keycloak/client-config)
    // with some additional information used in this service
    this.config = this.loadKeycloakConfig()
    // create Keycloak instance we'll be using for Authorization Flow and getting user profile
    // but this will not start the flow yet
    this.keycloak = this.createKeycloak()

    // the Keycloak instance we've created can be used to perform silent login, but we never start
    // implicit login - it should be started only at user request
    this.userProfile = this.loadUserProfile()

    this.originalFetch = fetch
    this.originalFetch = this.originalFetch.bind(window)
  }

  /**
   * Simply checks if Keycloak plugin should be enabled in _native_ mode (using `keycloak.js` library)
   * using `/keycloak/enabled` endpoint
   * @private
   */
  private async loadKeycloakEnabled(): Promise<boolean> {
    configManager.initItem('Keycloak Configuration', TaskState.started, 'config')
    return fetch(PATH_KEYCLOAK_ENABLED)
      .then(response => (response.ok && response.status == 200 ? response.text() : null))
      .then(data => {
        // Enable Keycloak only when explicitly enabled
        const enabled = data ? data.trim() === 'true' : false
        if (!enabled) {
          configManager.initItem('Keycloak Configuration', TaskState.skipped, 'config')
        }
        log.debug('Keycloak enabled:', enabled)
        return enabled
      })
      .catch(() => {
        configManager.initItem('Keycloak Configuration', TaskState.skipped, 'config')
        return false
      })
  }

  /**
   * Load Keycloak Client configuration required by `keycloak.js`
   * @private
   */
  private async loadKeycloakConfig(): Promise<HawtioKeycloakConfig | null> {
    const enabled = await this.enabled
    if (!enabled) {
      return null
    }
    return fetch(PATH_KEYCLOAK_CLIENT_CONFIG)
      .then(response => (response.ok && response.status == 200 ? response.json() : null))
      .then(json => {
        if (json) {
          log.debug('Loaded', PATH_KEYCLOAK_CLIENT_CONFIG, ':', json)
          return json as HawtioKeycloakConfig
        } else {
          // no client config and there's no (by design) chance to get the config later
          configManager.initItem('Keycloak Configuration', TaskState.skipped, 'config')
        }
        return null
      })
      .catch(() => {
        configManager.initItem('Keycloak Configuration', TaskState.skipped, 'config')
        return null
      })
  }

  /**
   * Create Keycloak object to communicate with Identity Provider
   * @private
   */
  private async createKeycloak(): Promise<Keycloak | null> {
    const enabled = await this.enabled
    const config = await this.config

    if (!enabled || !config) {
      log.debug('Keycloak disabled')
      return null
    }

    // add a method, so user can explicitly initiate Keycloak login
    configManager
      .configureAuthenticationMethod({
        method: AUTH_METHOD,
        login: this.keycloakLogin,
        position: 0,
      })
      .then(() => {
        // only now finish the initialization task
        configManager.initItem('Keycloak Configuration', TaskState.finished, 'config')
      })

    // we use keycloak.js in the old way, so we don't pass 'oidcProvider', but these 3 properties:
    // 'url', 'realm', 'clientId'
    return new Keycloak(config)
  }

  private keycloakLogin = async (silent = false): Promise<AuthenticationResult> => {
    const keycloak = await this.keycloak
    if (!keycloak) {
      return AuthenticationResult.configuration_error
    }
    if (!window.isSecureContext) {
      log.error("Can't perform Keycloak authentication in non-secure context")
      return AuthenticationResult.security_context_error
    }

    const options: KeycloakLoginOptions = {}
    if (silent) {
      options.prompt = 'none'
    }

    // this will cause redirect, so there's nothing to await for
    // after redirect we'll go through constructor(), init() and loadUserProfile() again
    await keycloak.login(options)

    return AuthenticationResult.ok
  }

  private async loadUserProfile(): Promise<KeycloakUserProfile | null> {
    const keycloak = await this.keycloak
    if (!keycloak) {
      return null
    }

    const initOptions = await this.getKeycloakInitOptions()
    try {
      const authenticated = await keycloak.init(initOptions)
      log.info('Initialised Keycloak: authenticated =', authenticated)
      if (!authenticated) {
        // do NOT invoke keycloak.login() - we want to give user explicit option
        // keycloak.login({ redirectUri: window.location.href })
        return null
      }

      try {
        const profile: KeycloakUserProfile = await keycloak.loadUserProfile()
        log.debug('Loaded Keycloak profile:', profile)
        profile.token = keycloak.token
        return profile
      } catch (error) {
        log.error('Failed to load user profile:', error)
      }
    } catch (error) {
      log.error('Failed to initialise Keycloak:', error)
    }
    return null
  }

  /**
   * Options for `Keycloak.init()`
   * @private
   */
  private async getKeycloakInitOptions(): Promise<KeycloakInitOptions> {
    const config = await this.config
    const pkceMethod = config?.pkceMethod
    return {
      // safer than 'query'
      responseMode: 'fragment',
      // means responseType = 'code'
      flow: 'standard',
      // check silent login by default
      onLoad: 'check-sso',
      // onLoad: 'login-required',
      pkceMethod,
      // this may be reset to false by Keycloak in check3pCookiesSupported()
      // reason may be strict cookie policy. But we'll use this option for silent SSO login
      checkLoginIframe: true,
    }
  }

  isKeycloakEnabled(): Promise<boolean> {
    return this.enabled
  }

  registerUserHooks(helpRegistration: () => void) {
    const fetchUser = async (resolve: ResolveUser) => {
      const keycloak = await this.keycloak
      const userProfile = await this.userProfile
      if (!keycloak || !userProfile) {
        return { isIgnore: true, isError: false, loginMethod: AUTH_METHOD }
      }

      if (userProfile.username && userProfile.token) {
        resolve({ username: userProfile.username, isLogin: true, loginMethod: AUTH_METHOD })
        userService.setToken(userProfile.token)
      }

      this.setupFetch()

      // only now register help tab for OIDC
      helpRegistration()

      return { isIgnore: false, isError: false, loginMethod: AUTH_METHOD }
    }
    userService.addFetchUserHook(AUTH_METHOD, fetchUser)

    const logout = async () => {
      const keycloak = await this.keycloak
      if (!keycloak) {
        return false
      }
      const config = await this.config
      let logoutUri = config?.logoutUri
      if (logoutUri) {
        if (!URL.canParse(logoutUri)) {
          // assume it's relative URL
          logoutUri = new URL(logoutUri, document.baseURI).href
        }
      }

      log.info('Log out Keycloak')
      try {
        await keycloak.logout({ redirectUri: logoutUri })
      } catch (error) {
        log.error('Error logging out Keycloak:', error)
      }
      return true
    }
    userService.addLogoutHook(AUTH_METHOD, logout)
  }

  private async setupFetch() {
    const keycloak = await this.keycloak
    const config = await this.config
    if (!keycloak || !config) {
      return
    }

    log.debug('Intercept Fetch API to attach Keycloak token to authorization header')
    const { fetch: originalFetch } = window
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const logPrefix = 'Fetch -'
      log.debug(logPrefix, 'Fetch intercepted for Keycloak authentication')

      if (!keycloak.authenticated || keycloak.isTokenExpired(KEYCLOAK_TOKEN_MINIMUM_VALIDITY)) {
        log.debug(logPrefix, 'Try to update token for request:', input)
        return new Promise((resolve, reject) => {
          this.updateToken(
            token => {
              if (token) {
                log.debug(logPrefix, 'Keycloak token refreshed. Set new value to userService')
                userService.setToken(token)
              }
              log.debug(logPrefix, 'Re-sending request after successfully updating Keycloak token:', input)
              resolve(fetch(input, init))
            },
            () => {
              log.debug(logPrefix, 'Logging out due to token update failed')
              userService.logout()
              reject()
            },
          )
        })
      }

      init = { ...init }

      if (config.jaas) {
        // Use BearerTokenLoginModule on server side
        if (keycloak.profile && keycloak.profile.username && keycloak.token) {
          init.headers = {
            ...init.headers,
            Authorization: basicAuthHeaderValue(keycloak.profile.username, keycloak.token),
          }
        } else {
          log.error(logPrefix, 'Keycloak username or token not found in JAAS mode:', keycloak.profile, keycloak.token)
        }
      } else {
        // Otherwise, bearer token is used
        init.headers = {
          ...init.headers,
          Authorization: `Bearer ${keycloak.token}`,
        }
      }

      // For CSRF protection with Spring Security
      const token = getCookie('XSRF-TOKEN')
      if (token) {
        log.debug(logPrefix, 'Set XSRF token header from cookies')
        init.headers = {
          ...init.headers,
          'X-XSRF-TOKEN': token,
        }
      }

      return originalFetch(input, init)
    }
  }

  private async updateToken(successFn: (token: string) => void, errorFn?: () => void) {
    const keycloak = await this.keycloak
    if (!keycloak) {
      return
    }

    keycloak
      .updateToken(KEYCLOAK_TOKEN_MINIMUM_VALIDITY)
      .then((refreshed: boolean) => {
        if (refreshed) {
          const token = keycloak.token
          if (token) {
            successFn(token)
          }
        } else {
          log.debug('Token is still valid')
        }
      })
      .catch((reason: Error) => {
        log.error("Couldn't update token:", reason)
        errorFn?.()
      })
  }

  // TODO: validate-subject-matches
  validateSubjectMatches(user: string): Promise<boolean> {
    const url = `${PATH_KEYCLOAK_VALIDATE}?keycloakUser=${encodeURIComponent(user)}`
    return fetchPath<boolean>(url, {
      success: (data: string) => {
        log.debug('Got response for validate subject matches:', data)
        return JSON.parse(data)
      },
      error: () => false,
    })
  }
}

export const keycloakService = new KeycloakService()

// Export non-exported definitions for testing
export const __testing__ = {
  KeycloakService,
}
