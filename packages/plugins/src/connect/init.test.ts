import fetchMock from 'jest-fetch-mock'
import { connectService } from './connect-service'
import { isActive } from './init'

jest.mock('__root__/connect/connect-service')

describe('isActive', () => {
  beforeEach(() => {
    jest.resetModules()
    fetchMock.resetMocks()
  })

  test('/proxy/enabled returns false', async () => {
    fetchMock.mockResponse('   false   \n')

    await expect(isActive()).resolves.toEqual(false)
  })

  test('/proxy/enabled returns not false & connection name is not set', async () => {
    fetchMock.mockResponse('true')
    connectService.getCurrentConnectionName = jest.fn(() => null)

    await expect(isActive()).resolves.toEqual(true)
  })

  test('/proxy/enabled returns not false & connection name is set', async () => {
    fetchMock.mockResponse('')
    connectService.getCurrentConnectionName = jest.fn(() => 'test-connection')

    await expect(isActive()).resolves.toEqual(false)
  })
})
