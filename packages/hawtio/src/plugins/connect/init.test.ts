import { connectService } from '@hawtiosrc/plugins/shared/connect-service'
import fetchMock from 'jest-fetch-mock'
import { isActive } from './init'

jest.mock('@hawtiosrc/plugins/shared/connect-service')

describe('isActive', () => {
  beforeEach(() => {
    jest.resetModules()
    fetchMock.resetMocks()
  })

  test('/proxy/enabled returns false', async () => {
    fetchMock.mockResponse('   false   \n')

    await expect(isActive()).resolves.toEqual(false)
  })

  test('/proxy/enabled returns not false & connection is not set', async () => {
    fetchMock.mockResponse('true')
    connectService.getCurrentConnectionId = jest.fn(async () => null)

    await expect(isActive()).resolves.toEqual(true)
  })

  test('/proxy/enabled returns not false & connection is set', async () => {
    fetchMock.mockResponse('')
    connectService.getCurrentConnectionId = jest.fn(async () => 'test-connection')

    await expect(isActive()).resolves.toEqual(false)
  })
})
