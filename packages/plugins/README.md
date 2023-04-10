# Hawtio React

A Hawtio reimplementation based on TypeScript + React.
This project reimplements the following Hawtio JS components in one project:

- [hawtio-core](https://github.com/hawtio/hawtio-core)
- [hawtio-integration](https://github.com/hawtio/hawtio-integration)
- [hawtio-oauth](https://github.com/hawtio/hawtio-oauth)

## Install

NPM

```console
npm i @hawtio/react
```

Yarn

```console
yarn add @hawtio/react
```

## Usage

```javascript
// Required styles
import '@hawtio/react/dist/index.css'
import '@patternfly/react-core/dist/styles/base.css'

import { configManager, hawtio, Hawtio } from '@hawtio/react'
import { registerPlugins } from '@hawtio/react-plugins'
import React from 'react'
import ReactDOM from 'react-dom/client'

// Activate builtin plugins
registerPlugins()
// Bootstrap Hawtio
hawtio.bootstrap()

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)
root.render(
  <React.StrictMode>
    <Hawtio />
  </React.StrictMode>
)
```

## License

Hawtio React is licensed under the [Apache 2.0 License](./LICENSE).
