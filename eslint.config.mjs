import jsPlugin from '@eslint/js'
import tsPlugin from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import-x'
import configPrettier from 'eslint-config-prettier'

import reactHooks from 'eslint-plugin-react-hooks'
import testingLibrary from 'eslint-plugin-testing-library'

export default [
  {
    ignores: [
      '*.js',
      '!/packages/hawtio/scripts/*.js',
      '*.cjs',
      '/app/*.js',
      '/app/*.cjs',
      '*.mjs',
      '**/.jestEnvVars.js',
      '.gitignore',
      '.dockerignore',
      '**/.env.*',
      '**/env.*',
      '**/ignore/**/*',
      '**/__mocks__/*.js',
      '**/testdata/**/*.js',
      '**/jest.config.ts',
      '**/tsup.config*.ts',
      '**/webpack*.cjs',
      '**/proxy-dev-server.js',
      '**/dist/*',
      '**/build/*',
    ],
  },

  configPrettier,
  jsPlugin.configs.recommended,
  ...tsPlugin.configs.recommended,
  importPlugin.flatConfigs.recommended,

  {
    plugins: {
      'react-hooks': reactHooks,
      'testing-library': testingLibrary,
    },

    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      ...reactHooks.configs.recommended.rules,

      semi: ['error', 'never'],

      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'none',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      '@typescript-eslint/explicit-member-accessibility': [
        'warn',
        {
          accessibility: 'no-public',
        },
      ],

      '@typescript-eslint/no-empty-function': [
        'error',
        {
          allow: ['constructors'],
        },
      ],

      '@typescript-eslint/no-redeclare': 'off',

      'import-x/no-default-export': 'error',
      'import-x/no-unresolved': 'off',
      'import-x/named': 'off',
      'import-x/first': 'error',

      'no-template-curly-in-string': 'error',
      'no-console': 'error',

      'testing-library/await-async-queries': 'off',
      'testing-library/no-debugging-utils': [
        'warn',
        {
          utilsToCheckFor: {
            debug: false,
          },
        },
      ],
    },
  },
]
