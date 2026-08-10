import React, { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { hawtio } from './core'
import './Hawtio.css'
import { HawtioLogin } from './ui/login'
import { HawtioPage } from './ui/page'

export type HawtioProps = {
  basepath?: string
}

export const Hawtio: React.FunctionComponent<HawtioProps> = props => {
  const { basepath } = props

  if (basepath) {
    hawtio.setBasePath(basepath)
  }

  /*
   * Initialise a window theme listener to update the application theme
   * depending on the browser's chosen / default theme or Hawtio preferences.
   *
   * Note: Will be ignored if a hawtio.disableThemeListener flag is set
   * to true in localStorage.
   */
  hawtio.addWindowThemeListener()

  useEffect(() => {
    return () => {
      /*
       * Clean up the window listener on unmount
       */
      hawtio.removeWindowThemeListener()
    }
  }, [])

  return (
    <BrowserRouter basename={hawtio.getBasePath()}>
      <Routes>
        <Route path='/login' element={<HawtioLogin />} />
        <Route path='*' element={<HawtioPage />} />
      </Routes>
    </BrowserRouter>
  )
}
