# @hawtio/react-app

A test application for @hawtio/react development.

## Developer notes

This is a JavaScript application which uses (in `dependencies` of its `package.json`) the _main_
`@hawtio/react` package.

While `@hawtio/react` is an NPM package bundled with `tsup` (`esbuild` + `rollup`), this application is bundled
using `webpack` to produce code running inside the browser.

This application not only shortens the dev cycle (change `@hawtio/react` - see results in the browser), it also
shows how other applications ([Hawtio Standalone](https://github.com/hawtio/hawtio/tree/4.x/console) being one of them):

- should be structured
- should use `webpack` and configure [Module Federation](https://webpack.js.org/concepts/module-federation/)
- should initialize and bootstrap `hawtio` classes
- should render main React component (`<Hawtio>`)

## dependencies, dev dependencies, peer dependencies

This `app` NPM package is bundled using Webpack and produces an _application_ that runs in the browser. This is _not_ a published NPM package and will never be a dependency of any other NPM project.

In terms of dependencies we have to remember a few things:

- This `app` definitely depends on `react`, `react-dom`, PatternFly libraries and `@hawtio/react` package
- This `app` transitively (implicitly) depends on other libraries (dependencies of the above)
- `webpack.config.cjs` configuration of this `app` uses some _shared modules_ (with the help of [Module Federation mechanism](https://webpack.js.org/concepts/module-federation/)).

Applications that are bundled with Webpack should not have any `peerDependencies`, because such applications are not used by other packages in their `dependencies`.

This `app` should declare a `dependency` only if it is used directly in its code (for example `src/bootstrap.tsx` imports React functions, so `react` should be a direct dependency). This `app` should not add Jolokia to it is `dependencies` - Webpack will bundle it together with `@hawtio/react` without problems.

If there's a need to select a specific version of a transitive package (for example due to security reasons or known CVE), such a dependency should be added to the `resolutions` config in `package.json`.

`@patternfly/react-core` and React libraries should be _peer dependencies_ of `@hawtio/react` package:

- these are declared as `shared` dependencies in Module Federation configuration in `webpack.config.cjs`
- the exact version should be specified by the _application_, not by the _library_
- another plugin library (for example the plugin from [Artemis Console](https://github.com/apache/activemq-artemis-console/)) could be used by this `app`, so it is easier to manage single versions of React and PatternFly at the _application_ level than at the level of both `@hawtio/react` and `artemis-console-extension`.

And finally there is one confusing, but recommended configuration - a _peer dependency_ usually should be added also as a _dev dependency_. There is only one reason - some package managers like [Yarn](https://yarnpkg.com/) or NPM before version 7 do **not** install peer dependencies. As a proof of this confusing convention, here is a fragment from the `react-router` package:

```json
"devDependencies": {
  "react": "^18.2.0",
  "react-router": "^7.18.2"
},
"peerDependencies": {
  "react": ">=16.8"
},
```

## PatternFly dependencies

The first dependency on PatternFly library is `@patternfly/react-core`. It directly depends on (declaration in its `dependencies`) 3 other libraries: `@patternfly/react-icons`, `@patternfly/react-styles` and `@patternfly/react-tokens`.

There are other PatternFly libraries we use: `@patternfly/react-charts`, `@patternfly/react-code-editor` and `@patternfly/react-table`, which also depend on icons, styles and tokens.

So we can identify these PatternFly libraries:

- direct dependencies: `@patternfly/react-core`, `@patternfly/react-table`, `@patternfly/react-charts` and `@patternfly/react-code-editor`
- transitive dependencies: `@patternfly/react-icons`, `@patternfly/react-styles` and `@patternfly/react-tokens`

But because we actually use the transitive dependencies directly (and not just need them for `@hawtio/react-core` to work), we use all 7 PatternFly dependencies as peer dependencies at `@hawtio/react` level, so the actual versions are set at the _application_ level.
For `yarn install` to work and to run the tests, we specify these versions in `devDependencies` of `@hawtio/react` too.

## A note about semantic versioning

For Yarn, `defaultSemverRangePrefix` option defaults to `"^"`. When adding dependencies you can also use one of

    yarn add <dependency> --caret
    yarn add <dependency> --tilde
    yarn add <dependency> --exact

It may be confusing to distinguish between caret and tilde versioning, so here is the definition:

- `"^"` preserves the left-most non-zero digit
- `"~"` allows only patch changes (3rd digit) if minor (2nd digit) is specified, allows minor changes if minor is not specified

Still confused?

- `~1.2.3` allows updates like: `1.2.4`, `1.2.5`, but not `1.3.0` - safer, for "implementors"
- `^1.2.3` allows updates like: `1.3.0`, `1.4.5`, but not `2.0.0` - faster (access to new versions), for "users"
- `~0.2.3` allows updates like: `0.2.4`, `0.2.5`, but not `0.3.0`
- `^0.2.3` allows updates like: `0.2.4`, `0.2.5`, but not `0.3.0` - `2` is treated as _major_ here
- `^0.0.3` doesn't even allow `0.0.4` - `3` is treated as _major_ here

Also, `1.2` is the same as `1.2.0` and `1` is the same as `1.0.0`, so:

- `~1.2`: `>=1.2.0 <1.3.0`
- `~1`: `>=1.0.0 <2.0.0`
- `^1.2`: `>=1.2.0 <2.0.0`
- `^1`: `>=1.0.0 <2.0.0`
- `~0.2`: `>=0.2.0 <0.3.0`
- `~0`: `>=0.0.0 <1.0.0`
- `^0.2`: `>=0.2.0 <0.3.0`
- `^0`: `>=0.0.0 <1.0.0` (exception to the rule of "left-most non-zero digit", because there's no left-most non-zero digit)
