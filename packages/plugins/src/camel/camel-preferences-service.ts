export interface ICamelPreferencesService {
  loadCamelPreferences(): CamelOptions
  saveCamelPreferences(newValues: Partial<CamelOptions>): void
}

export type CamelOptions = {
  isHideOptionDocumentation: boolean
  isHideDefaultOptionValues: boolean
  isHideUnusedOptionValues: boolean
  isIncludeTraceDebugStreams: boolean
  maximumTraceDebugBodyLength: number
  maximumLabelWidth: number
  isIgnoreIDForLabel: boolean
  isShowInflightCounter: boolean
  routeMetricMaximumSeconds: number
}

export const CAMEL_PREFERENCES_DEFAULT_VALUES: CamelOptions = {
  isHideOptionDocumentation: false,
  isHideDefaultOptionValues: false,
  isHideUnusedOptionValues: false,
  isIncludeTraceDebugStreams: false,
  maximumTraceDebugBodyLength: 5000,
  maximumLabelWidth: 34,
  isIgnoreIDForLabel: false,
  isShowInflightCounter: true,
  routeMetricMaximumSeconds: 10,
} as const

export const STORAGE_KEY_CAMEL_PREFERENCES = 'camel.preferences'

class CamelPreferencesService implements ICamelPreferencesService {
  loadCamelPreferences(): CamelOptions {
    return { ...CAMEL_PREFERENCES_DEFAULT_VALUES, ...this.loadFromStorage() }
  }

  saveCamelPreferences(newValues: Partial<CamelOptions>): void {
    const preferencesToSave = { ...this.loadFromStorage(), ...newValues }

    localStorage.setItem(STORAGE_KEY_CAMEL_PREFERENCES, JSON.stringify(preferencesToSave))
  }

  private loadFromStorage(): Partial<CamelOptions> {
    const localStorageData = localStorage.getItem(STORAGE_KEY_CAMEL_PREFERENCES)

    return localStorageData ? JSON.parse(localStorageData) : {}
  }
}

export const camelPreferencesService = new CamelPreferencesService()
