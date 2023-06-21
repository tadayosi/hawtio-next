import { log } from './globals'

const STORAGE_KEY_SHOW_VERTICAL_NAV_BY_DEFAULT = 'preferences.showVerticalNavByDefault'
const SESSION_KEY_RESET_SUCCESS = 'preferences.resetSuccess'

export interface IPreferencesService {
  isShowVerticalNavByDefault(): boolean
  saveShowVerticalNavByDefault(value: boolean): void
  reset(): void
  isResetSuccess(): boolean
  setProtectedItem(setting: string, value: string): void
}

class PreferencesService implements IPreferencesService {
  private protectedSettings: Set<string> = new Set()

  constructor() {
    // Protect the connect.connections setting to stop it being reset.
    this.protectedSettings.add('connect.connections')
  }

  isShowVerticalNavByDefault(): boolean {
    const value = localStorage.getItem(STORAGE_KEY_SHOW_VERTICAL_NAV_BY_DEFAULT)
    return value ? JSON.parse(value) : true
  }

  saveShowVerticalNavByDefault(value: boolean): void {
    localStorage.setItem(STORAGE_KEY_SHOW_VERTICAL_NAV_BY_DEFAULT, JSON.stringify(value))
  }

  /*
   * Ensure that the given application setting is preserved
   * from being reset by the preferencesService.reset() function
   */
  setProtectedItem(setting: string, value: string) {
    localStorage.setItem(setting, value)
    this.protectedSettings.add(setting)
  }

  reset() {
    // Backup the storage K/V pairs that are not actual preferences.
    // Ideally, the preferences would be better organised under structured keys
    // that would be provided to the preferences registry, so that a local storage
    // complete clear operation and restore of hard-coded K/V pairs could be avoided.
    //
    // This can only happen if a migration function was implemented that on initialisation
    // of the application, all existing user settings were migrated to the new structured keys.
    //
    log.info('Resetting Hawtio preferences')

    // Backup protected settings
    const backup: Record<string, string | null> = {}
    for (const setting of this.protectedSettings) {
      backup[setting] = localStorage.getItem(setting)
    }

    // Clear all local storage
    localStorage.clear()

    // Restore protected settings
    for (const setting of this.protectedSettings) {
      const value = backup[setting]
      if (value !== null && value !== undefined) {
        localStorage.setItem(setting, value)
      }
    }

    sessionStorage.setItem(SESSION_KEY_RESET_SUCCESS, 'true')
  }

  isResetSuccess(): boolean {
    const value = sessionStorage.getItem(SESSION_KEY_RESET_SUCCESS)

    // This alert is one-time only, so clean up after read every time.
    // Not cleaning up immediately because React renders twice in development env,
    // so otherwise the alert is always wiped out before real rendering.
    setTimeout(() => sessionStorage.removeItem(SESSION_KEY_RESET_SUCCESS), 1000)

    return value ? JSON.parse(value) : false
  }
}

export const preferencesService = new PreferencesService()
