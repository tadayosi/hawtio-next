import { eventService, FormAuthenticationMethod } from '@hawtiosrc/core'
import { log } from './globals'

const STORAGE_KEY_LOGIN = 'login'

export type LoginResult = { type: 'success' } | { type: 'failure' } | { type: 'unauthorized' } | { type: 'forbidden' } | { type: 'throttled'; retryAfter: number }

export interface ILoginService {
  login(username: string, password: string, remember: boolean, method: FormAuthenticationMethod): Promise<LoginResult>
  getUser(): string
  rememberUser(username: string): void
  clearUser(): void
}

class LoginService implements ILoginService {
  async login(
    username: string,
    password: string,
    remember: boolean,
    method: FormAuthenticationMethod,
  ): Promise<LoginResult> {
    try {
      const res = await fetch(method.url, {
        method: 'POST',
        headers: {
          'Content-Type': method.type === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
        },
        body:
          method.type === 'json'
            ? JSON.stringify({ [method.userField]: username, [method.passwordField]: password })
            : '',
      })
      if (!res.ok) {
        // Login failed
        log.error('Login error:', res)
        if (res.status === 429) {
          // Login throttled
          const retryAfter = parseInt(res.headers.get('Retry-After') ?? '0')
          return { type: 'throttled', retryAfter }
        }
        else if (res.status === 401) {
          return { type: 'unauthorized' }
        } else if (res.status === 403) {
          return { type: 'forbidden' }
        } else {
          return { type: 'failure' }
        }
      }

      const data = await res.text()
      log.debug('Server login success:', data)
      if (remember) {
        this.rememberUser(username)
      } else {
        this.clearUser()
      }
      return { type: 'success' }
    } catch (err) {
      // System error at login
      log.error('Login error:', err)
      eventService.notify({
        type: 'danger',
        message: `Login error: ${err}`,
      })
      return { type: 'failure' }
    }
  }

  getUser(): string {
    const login = localStorage.getItem(STORAGE_KEY_LOGIN)
    if (!login) {
      return ''
    }
    return JSON.parse(login).username ?? ''
  }

  rememberUser(username: string) {
    localStorage.setItem(STORAGE_KEY_LOGIN, JSON.stringify({ username }))
  }

  clearUser() {
    localStorage.removeItem(STORAGE_KEY_LOGIN)
  }
}

export const loginService = new LoginService()
