import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { HawtioContextProvider } from './context'
import './Hawtio.css'
import { HawtioPage } from './ui/page/HawtioPage'
import { documentBase } from './util/documents'

export type HawtioProps = {
  basepath?: string
}

export const Hawtio: React.FunctionComponent<HawtioProps> = props => {
  const { basepath } = props
  const basename = basepath ? basepath : documentBase()
  return (
    <HawtioContextProvider>
      <BrowserRouter basename={basename}>
        <HawtioPage />
      </BrowserRouter>
    </HawtioContextProvider>
  )
}
