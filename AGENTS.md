# AGENTS.md

Guidelines for AI coding agents working on this repository.

## Project Info

- Language: TypeScript + React
- Build tools: [tsup](https://tsup.egoist.dev/) (library), [Webpack](https://webpack.js.org/) (app)
- Package manager: Yarn v4 (Berry)
- UI framework: [PatternFly v6](https://www.patternfly.org/)
- Key dependencies: React, jolokia.js
- Linter/Formatter: ESLint + typescript-eslint, Prettier
- Commit style: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

## Project Structure

```text
.
├── packages/
│   ├── hawtio/              # @hawtio/react — main library (TypeScript, built with tsup)
│   └── backend-middleware/  # @hawtio/backend-middleware — Express middleware for dev proxy
└── app/                     # sample app for local development (built with Webpack)
```

## Documentation Index

Read these documents **only when the task requires it** — do not load them all upfront.

| Document | When to read |
| --- | --- |
| [`README.md`](README.md) | Project overview, prerequisites, contributing guide |
| [`docs/architecture.md`](docs/architecture.md) | Core concepts: Jolokia, JMX, plugin system, backend types, authentication flows |
| [`docs/developing.md`](docs/developing.md) | Coding conventions, React component guidelines, dependency policy, commit style |
| [`docs/e2e.md`](docs/e2e.md) | Running E2E tests locally against a live backend |
| [`docs/releasing.md`](docs/releasing.md) | Release procedure and versioning policy |

## Essential Commands

```bash
yarn install          # install dependencies
yarn build:all        # build all packages
yarn start            # start dev server at http://localhost:3000/
yarn test:all         # run unit tests
yarn lint             # ESLint
yarn format:check     # Prettier check
```
