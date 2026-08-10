import { Plugin } from '@hawtiosrc/core'
import { createContext, useContext } from 'react'
import { useLocation, type Location } from 'react-router'

export type PageContext = {
  username: string
  plugins: Plugin[]
}

/**
 * PageContext gives access to:
 * * login name of currently logged in user
 * * an array of plugins available in Hawtio - to be displayed in `<HawtioSidebar>`
 *
 * This context is _provided_ in top level `<HawtioPage>` component and provides read-only information
 * about current username and a list of loaded plugins.
 * The state is managed in `useUser` and `usePlugins` hooks.
 */
export const PageContext = createContext<PageContext>({
  username: '',
  plugins: [],
})

/**
 * Hawtio variant of React Router's `useLocation()` hook. It overrides `search` value to not contain any parameter
 * declared by plugins as "known query param". The original `search` is returned as `fullSearch`.
 *
 * The hook should be used to construct navigation links without plugin-specific query parameters.
 */
export function useHawtioLocation(): Location & { fullSearch: string } {
  const { plugins } = useContext(PageContext)
  const location = useLocation()

  const params = new URLSearchParams(location.search)

  plugins.forEach(plugin => {
    if (plugin.knownQueryParams) {
      plugin.knownQueryParams.forEach(k => {
        params.delete(k)
      })
    }
  })

  return { ...location, search: params.toString(), fullSearch: location.search }
}
