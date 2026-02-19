const { ModuleFederationPlugin } = require('webpack').container
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')
const { dependencies } = require('./package.json')
const { hawtioBackend } = require('@hawtio/backend-middleware')
const path = require('path')
const bodyParser = require('body-parser')

const publicPath = '/hawtio'
const outputPath = path.resolve(__dirname, 'build')

const port = 3000

module.exports = (_, args) => {
  const isProduction = args.mode === 'production'
  return [
    // this is the "main" webpack configuration which builds entire application
    {
      entry: './src/index',

      /*
       * To debug in development with source maps * update accordingly
       *
       * For other alternatives see * https://webpack.js.org/configuration/devtool
       */
      devtool: isProduction ? 'source-map' : false,
      plugins: [
        new ModuleFederationPlugin({
          // _host_ is an application that can:
          //  - consume modules from "remotes" provided by other _hosts_ (ContainerReferencePlugin)
          //  - provide modules from "exposes" to be consumed by other _hosts_ (ContainerPlugin).
          //
          // "name" is required only if the _host_ uses "exposes" and it creates:
          // "webpack/container/entry/app" module
          name: 'app',
          // "filename" is only for ContainerPlugin (for "exposes").
          // there's a single "remoteEntry.js" for any number of exposed modules
          filename: 'remoteEntry.js',
          exposes: {
            './remote1': './src/examples/remote1',
            './remote2': './src/examples/remote2',
          },
          // keys in this map are used in `webpack/container/reference/${key}` pattern
          // the part before "@" should match "name" of some (could be different, but also this very same, as here)
          // ModuleFederationPlugin configuration.
          // This webpack.config.cjs provides one more configuration with own ModuleFederationPlugin configuration
          // so here "app" matches our own ModuleFederationPlugin config's "name"
          // All declared entries in "remotes" can be imported using `import` or `import()` in JavaScript code.
          // When an entry is not declared here, we can still consume such module using @module-federation/utilities
          remotes: {
            'static-remotes': `app@http://localhost:${port}/hawtio/remoteEntry.js`,
          },
          shared: {
            ...dependencies,
            react: {
              singleton: true,
              requiredVersion: dependencies['react'],
            },
            'react-dom': {
              singleton: true,
              requiredVersion: dependencies['react-dom'],
            },
            'react-router-dom': {
              singleton: true,
              requiredVersion: dependencies['react-router-dom'],
            },
            '@hawtio/react': {
              singleton: true,
              // Hardcoding needed because it cannot handle yarn 'workspace:*' version
              requiredVersion: '^2.0.0-dev.2',
            },
            '@patternfly/react-core': {
              singleton: true,
              requiredVersion: dependencies['@patternfly/react-core'],
            },
          },
        }),
        new HtmlWebpackPlugin({
          template: path.resolve(__dirname, 'public/index.html'),
          favicon: path.resolve(__dirname, 'public/favicon.ico'),
          // Trailing slash is really important for proper base path handling
          base: publicPath + '/',
          publicPath,
          // this ensures that we don't have <script> tag for "remoteEntry.js"
          // which is loaded by different means (by webpack code itself, without
          // adding static <script> element to <head>
          chunks: ['main'],
        }),
        new CopyWebpackPlugin({
          patterns: [
            {
              from: '**/*',
              to: outputPath,
              context: 'public/',
              globOptions: {
                ignore: ['**/index.html', '**/favicon.ico'],
              },
            },
          ],
        }),
        new MonacoWebpackPlugin({
          // 'html' is required as workaround for 'xml'
          // https://github.com/microsoft/monaco-editor/issues/1509
          languages: ['xml', 'json', 'html'],
          globalAPI: true,
        }),
      ],
      output: {
        clean: true,
        path: outputPath,
        publicPath: 'auto',
        filename: isProduction ? 'static/js/[name].[contenthash:8].js' : 'static/js/bundle.js',
        chunkFilename: isProduction ? 'static/js/[name].[contenthash:8].chunk.js' : 'static/js/[name].chunk.js',
        assetModuleFilename: 'static/media/[name].[hash][ext]',
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: {
              loader: 'swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                  },
                },
              },
            },
          },
          {
            test: /\.js$/,
            enforce: 'pre',
            use: ['source-map-loader'],
          },
          {
            test: /\.css$/i,
            use: ['style-loader', 'css-loader'],
          },
          {
            test: /\.(png|svg|jpg|jpeg|gif)$/i,
            type: 'asset/resource',
          },
          {
            test: /\.(woff|woff2|eot|ttf|otf)$/i,
            type: 'asset/resource',
          },
          {
            test: /\.md$/i,
            type: 'asset/source',
          },
        ],
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        symlinks: false,
        alias: {
          '@thumbmarkjs/thumbmarkjs': path.join(__dirname, '../node_modules/@thumbmarkjs/thumbmarkjs/dist/thumbmark.esm.js'),
        },
      },
      ignoreWarnings: [
        // For suppressing sourcemap warnings coming from some dependencies
        /Failed to parse source map/,
        /Critical dependency: the request of a dependency is an expression/,
      ],
      performance: {
        maxAssetSize: 1000000, // 1MB for now
      },
      devServer: {
        port: port,
        static: path.join(__dirname, 'public'),
        historyApiFallback: {
          // Needed to fallback to bundled index instead of public/index.html template
          index: publicPath,
        },
        hot: !process.env.DISABLE_WS,
        liveReload: !process.env.DISABLE_WS,
        // changing to "ws" adds 20+ more modules to webpack-generated bundle
        webSocketServer: process.env.DISABLE_WS ? false : 'ws',
        devMiddleware: {
          publicPath,
          writeToDisk: true,
        },
        setupMiddlewares: (middlewares, devServer) => {
          // handle incoming JSON mime data, so handlers have access to JSONified req.body
          devServer.app.use(bodyParser.json())

          // Redirect / or /hawtio to /hawtio/
          if (publicPath && publicPath !== '/') {
            devServer.app.get('/', (_, res) => res.redirect(`${publicPath}/`))
            devServer.app.get(`${publicPath}$`, (_, res) => res.redirect(`${publicPath}/`))
          }

          /* Hawtio userinfo / login / logout mock endpoints */

          let login = true
          let username = 'developer'
          devServer.app.get(`${publicPath}/user`, (_, res) => {
            if (login) {
              res.send(`"${username}"`)
            } else {
              res.sendStatus(403)
            }
          })
          devServer.app.post(`${publicPath}/auth/login`, (req, res) => {
            // Test authentication throttling with username 'throttled'
            const cred = req.body
            if (cred.username === 'throttled') {
              res.append('Retry-After', '10') // 10 secs
              res.sendStatus(429)
              return
            }

            login = true
            username = cred.username
            res.send(String(login))
          })
          devServer.app.get(`${publicPath}/auth/logout`, (_, res) => {
            login = false
            username = null
            res.redirect(`${publicPath}/login`)
          })

          /* Testing preset connections */

          // devServer.app.get(`${publicPath}/preset-connections`, (_, res) => {
          //   res.type('application/json')
          //   res.send(
          //     JSON.stringify([
          //       { name: 'test1', scheme: 'http', host: 'localhost', port: 8778, path: '/jolokia/' },
          //       { name: 'test2' },
          //     ]),
          //   )
          // })

          /* Configuration endpoints - global and for plugins */

          const proxyEnabled = true
          devServer.app.get(`${publicPath}/proxy/enabled`, (_, res) => {
            res.send(String(proxyEnabled))
          })

          devServer.app.get(`${publicPath}/auth/config/session-timeout`, (_, res) => {
            res.type('application/json')
            res.send('{ timeout: -1 }')
          })

          /* Available plugins - for Module Federation plugins not handled by Webpack at build time */

          const plugin = [
            {
              url: `http://localhost:${port}/hawtio`,
              scope: 'appRemote',
              module: './remote3',
              remoteEntryFileName: 'remoteExternalEntry.js',
              pluginEntry: 'registerRemote',
            },
            {
              url: `http://localhost:${port}/hawtio`,
              scope: 'appRemote',
              module: './remote3-deferred',
              remoteEntryFileName: 'remoteExternalEntry.js',
              pluginEntry: 'registerRemoteDeferred',
            },
          ]
          devServer.app.get(`${publicPath}/plugin`, (_, res) => {
            res.send(JSON.stringify(plugin))
          })

          /* Keycloak */

          const keycloakEnabled = false
          const keycloakClientConfig = {
            realm: 'hawtio-demo',
            clientId: 'hawtio-client',
            url: 'http://localhost:18080/',
            jaas: false,
            pkceMethod: 'S256',
          }
          devServer.app.get(`${publicPath}/keycloak/enabled`, (_, res) => {
            res.send(String(keycloakEnabled))
          })
          devServer.app.get(`${publicPath}/keycloak/client-config`, (_, res) => {
            res.send(JSON.stringify(keycloakClientConfig))
          })
          devServer.app.get(`${publicPath}/keycloak/validate-subject-matches`, (_, res) => {
            res.send('true')
          })

          /* OpenID Connect */

          const oidcEnabled = true
          //const entraIDOidcConfig = {
          //  method: 'oidc',
          //  provider: 'https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555/v2.0',
          //  client_id: '66666666-7777-8888-9999-000000000000',
          //  response_mode: 'fragment',
          //  scope: 'openid email profile api://hawtio-server/Jolokia.Access',
          //  redirect_uri: `http://localhost:${port}/hawtio/`,
          //  code_challenge_method: 'S256',
          //  prompt: null
          //  // prompt: 'login',
          //}
          const keycloakOidcConfig = {
            // configuration suitable for Keycloak run from https://github.com/hawtio/hawtio
            // repository using examples/keycloak-integration/run-keycloak.sh
            method: 'oidc',
            // position is not mandatory and will be calculated when absent
            position: 0,
            provider: 'http://127.0.0.1:18080/realms/hawtio-demo',
            client_id: 'hawtio-client',
            response_mode: 'fragment',
            scope: 'openid email profile',
            redirect_uri: `http://localhost:${port}/hawtio/`,
            code_challenge_method: 'S256',
            prompt: null,
            // Hawtio (oidc plugin) will fetch this configuration from .well-known/openid-configuration
            // with Hawtio Java it may already be part of this response
            'openid-configuration': null,
          }
          const springSecurityOidcConfig = {
            // configuration suitable for Keycloak run from https://github.com/hawtio/hawtio
            // repository using examples/keycloak-integration/run-keycloak.sh
            method: 'oidc',
            position: 1,
            provider: 'http://127.0.0.1:9000/',
            client_id: 'oidc-client',
            response_mode: 'query',
            scope: 'openid profile',
            redirect_uri: `http://localhost:${port}/hawtio/`,
            code_challenge_method: 'S256',
            prompt: null,
            // Hawtio (oidc plugin) will fetch this configuration from .well-known/openid-configuration
            // with Hawtio Java it may already be part of this response
            'openid-configuration': null,
          }
          devServer.app.get(`${publicPath}/auth/config/oidc`, (_, res) => {
            res.type('application/json')
            if (oidcEnabled) {
              // res.send(JSON.stringify(keycloakOidcConfig))
              // res.send(JSON.stringify(springSecurityOidcConfig))
              res.send(JSON.stringify([keycloakOidcConfig, springSecurityOidcConfig]))
            } else {
              res.send('{}')
            }
          })

          /* Available authentication methods to configure <HawtioLogin> page */

          const authLoginConfig = [
            // {
            //   method: 'basic',
            //   name: 'Basic Authentication',
            //   realm: 'Hawtio Realm',
            // },
            {
              // special method that is declared at server side, but never handled in @hawtio/react
              method: 'external',
              name: 'Spring Security',
            },
            // {
            //   "method": "form",
            //   "name": "Form/Session Authentication (application/x-www-form-urlencoded)",
            //   "url": `${publicPath}/auth/login`,
            //   "logoutUrl": `${publicPath}/auth/logout`,
            //   "type": "form",
            //   "userField": "username",
            //   "passwordField": "password"
            // },
            {
              method: 'form',
              name: 'Form/Session Authentication (application/json)',
              url: `${publicPath}/auth/login`,
              logoutUrl: `${publicPath}/auth/logout`,
              type: 'json',
              userField: 'username',
              passwordField: 'password',
            },
          ]

          if (keycloakEnabled) {
            authLoginConfig.push({
              // Actual configuration of Keycloak provider will be added from
              // /keycloak/client-config endpoint
              method: 'keycloak',
              name: 'Keycloak (keycloak.js)',
            })
          }
          if (oidcEnabled) {
            authLoginConfig.push({
              // Actual configuration of OIDC provider will be added from
              // /auth/config/oidc endpoint
              method: 'oidc',
              // position can be calculated if in the matching order with /auth/config/oidc endpoint
              // position: 0,
              name: 'OpenID Connect (Keycloak)',
            })
            authLoginConfig.push({
              // Actual configuration of OIDC provider will be added from
              // /auth/config/oidc endpoint
              method: 'oidc',
              // position: 1,
              name: 'OpenID Connect (Spring Authorization Server)',
            })
          }

          devServer.app.get(`${publicPath}/auth/config/login`, (_, res) => {
            if (!(keycloakEnabled || oidcEnabled)) {
              res.json([])
            } else {
              res.json(authLoginConfig)
            }
          })

          // Hawtio backend middleware should be run before other middlewares (thus 'unshift')
          // in order to handle GET requests to the proxied Jolokia endpoint.
          middlewares.unshift({
            name: 'hawtio-backend',
            path: `${publicPath}/proxy`,
            middleware: hawtioBackend({
              // Uncomment it if you want to see debug log for Hawtio backend
              logLevel: 'debug',
            }),
          })

          return middlewares
        },
      },
    },
    // this is a very slim configuration which only builds a file used as exposed entry point for ModuleFederation plugin
    // which will be loaded dynamically by Hawtio using @module-federation/utilities
    {
      entry: './src/examples/remote3',
      devtool: false,
      plugins: [
        new ModuleFederationPlugin({
          name: 'appRemote',
          filename: 'remoteExternalEntry.js',
          exposes: {
            './remote3': './src/examples/remote3',
            './remote3-deferred': './src/examples/remote3-deferred',
          },
          shared: {
            ...dependencies,
            react: {
              singleton: true,
              requiredVersion: dependencies['react'],
            },
            'react-dom': {
              singleton: true,
              requiredVersion: dependencies['react-dom'],
            },
            'react-router-dom': {
              singleton: true,
              requiredVersion: dependencies['react-router-dom'],
            },
            '@hawtio/react': {
              singleton: true,
              // Hardcoding needed because it cannot handle yarn 'workspace:*' version
              requiredVersion: '^2.0.0-dev.2',
            },
            '@patternfly/react-core': {
              singleton: true,
              requiredVersion: dependencies['@patternfly/react-core'],
            },
          },
        }),
      ],
      output: {
        clean: true,
        path: path.resolve(__dirname, 'build-remote'),
        publicPath: 'auto',
        filename: isProduction ? 'static/js/[name].[contenthash:8].js' : 'static/js/bundle.js',
        chunkFilename: isProduction ? 'static/js/[name].[contenthash:8].chunk.js' : 'static/js/[name].chunk.js',
        assetModuleFilename: 'static/media/[name].[hash][ext]',
        uniqueName: 'module-federation-external-module',
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: {
              loader: 'swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                  },
                },
              },
            },
          },
          {
            test: /\.css$/i,
            use: ['style-loader', 'css-loader'],
          },
          {
            test: /\.(png|svg|jpg|jpeg|gif)$/i,
            type: 'asset/resource',
          },
          {
            test: /\.(woff|woff2|eot|ttf|otf)$/i,
            type: 'asset/resource',
          },
          {
            test: /\.md$/i,
            type: 'asset/source',
          },
        ],
      },
    },
  ]
}
