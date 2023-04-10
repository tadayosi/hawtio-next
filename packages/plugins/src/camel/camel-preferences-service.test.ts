import {
  CamelOptions,
  camelPreferencesService,
  CAMEL_PREFERENCES_DEFAULT_VALUES,
  STORAGE_KEY_CAMEL_PREFERENCES,
} from './camel-preferences-service'

describe('camel-preferences-service', () => {
  // Mocking local-storage is not very straightforward so we'll be using it directly
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY_CAMEL_PREFERENCES)
  })

  describe('Load preferences', () => {
    test('Retrieves default values on empty storage', () => {
      //Given
      localStorage.removeItem(STORAGE_KEY_CAMEL_PREFERENCES)

      //When
      const preferences = camelPreferencesService.loadCamelPreferences()

      //Then
      expect(preferences).toEqual(CAMEL_PREFERENCES_DEFAULT_VALUES)
    })

    test('Retrieves stored values when they is some key stored, and the default for the others', () => {
      //Given
      localStorage.setItem(STORAGE_KEY_CAMEL_PREFERENCES, JSON.stringify({ maximumLabelWidth: 5 }))

      //When
      const preferences = camelPreferencesService.loadCamelPreferences()

      //Then
      expect(preferences).toEqual({ ...CAMEL_PREFERENCES_DEFAULT_VALUES, maximumLabelWidth: 5 })
    })

    test('Retrieves all the values', () => {
      //Given
      const savedString =
        '{"isHideOptionDocumentation":true,"isHideDefaultOptionValues":false,"isHideUnusedOptionValues":true,"isIncludeTraceDebugStreams":false,"maximumTraceDebugBodyLength":134234,"maximumLabelWidth":34,"isIgnoreIDForLabel":true,"isShowInflightCounter":true,"routeMetricMaximumSeconds":10,"key":true}'
      const expected: Partial<CamelOptions> = {
        isHideUnusedOptionValues: true,
        maximumTraceDebugBodyLength: 134234,
        isIgnoreIDForLabel: true,
      }
      localStorage.setItem(STORAGE_KEY_CAMEL_PREFERENCES, savedString)

      //When
      const preferences = camelPreferencesService.loadCamelPreferences()

      //Then
      expect(preferences).toMatchObject(expected)
    })
  })

  describe('Saving preferences', () => {
    test('Saving single preference', () => {
      //Given
      const savedPreference: Partial<CamelOptions> = {
        isHideOptionDocumentation: true,
      }
      const expectedString = JSON.stringify(savedPreference)

      //When
      camelPreferencesService.saveCamelPreferences(savedPreference)

      //Then
      expect(localStorage.getItem(STORAGE_KEY_CAMEL_PREFERENCES)).toEqual(expectedString)
    })

    test('Overwriting saved preferences correctly overwrites the preference', () => {
      //Given
      const savedPreference: Partial<CamelOptions> = {
        maximumLabelWidth: 5,
        isHideDefaultOptionValues: true,
      }
      const overwrittenPreference: Partial<CamelOptions> = {
        maximumLabelWidth: 4,
      }
      localStorage.setItem(STORAGE_KEY_CAMEL_PREFERENCES, JSON.stringify(savedPreference))
      const expectedString = JSON.stringify({ ...savedPreference, ...overwrittenPreference })

      //When
      camelPreferencesService.saveCamelPreferences(overwrittenPreference)

      //Then
      expect(localStorage.getItem(STORAGE_KEY_CAMEL_PREFERENCES)).toEqual(expectedString)
    })
  })
})

export {}
