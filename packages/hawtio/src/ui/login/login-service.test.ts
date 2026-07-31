import fetchMock from 'jest-fetch-mock'
import { loginService } from './login-service'
import { FormAuthenticationMethod } from '@hawtiosrc/core'
import { PATH_LOGIN, PATH_LOGOUT } from '@hawtiosrc/auth/globals'

describe('LoginService', () => {
  const method: FormAuthenticationMethod = {
    method: 'form',
    url: PATH_LOGIN,
    logoutUrl: PATH_LOGOUT,
    type: 'json',
    userField: 'username',
    passwordField: 'password',
  }

  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('loginService exists', () => {
    expect(loginService).not.toBeNull()
  })

  test('remember username', () => {
    expect(loginService.getUser()).toEqual('')
    loginService.rememberUser('test-user')
    expect(loginService.getUser()).toEqual('test-user')
    loginService.clearUser()
    expect(loginService.getUser()).toEqual('')
  })

  test('login with remembering username', async () => {
    fetchMock.mockResponse('true')

    const result = await loginService.login('test-user', 'password!', true, method)
    expect(result.type).toBe('success')
    expect(loginService.getUser()).toEqual('test-user')
  })

  test('login without remembering username', async () => {
    fetchMock.mockResponse('true')

    const result = await loginService.login('test-user', 'password!', false, method)
    expect(result.type).toBe('success')
    expect(loginService.getUser()).toEqual('')
  })

  test('login failed', async () => {
    fetchMock.mockResponse('', { status: 400 })

    const result = await loginService.login('test-user', 'password!', false, method)
    expect(result.type).toBe('failure')
  })

  test('login unauthorized', async () => {
    fetchMock.mockResponse('', { status: 401 })

    const result = await loginService.login('test-user', 'password!', false, method)
    expect(result.type).toBe('unauthorized')
  })

  test('login forbidden', async () => {
    fetchMock.mockResponse('', { status: 403 })

    const result = await loginService.login('test-user', 'password!', false, method)
    expect(result.type).toBe('forbidden')
  })

  test('login throttled', async () => {
    fetchMock.mockResponse('', { status: 429, headers: { 'Retry-After': '60' } })

    const result = await loginService.login('test-user', 'password!', false, method)
    expect(result.type).toBe('throttled')
    expect(result.type === 'throttled' && result.retryAfter).toBe(60)
  })
})
