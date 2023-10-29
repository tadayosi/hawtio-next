module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:testing-library/react',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    'no-console': 'error',
    semi: ['error', 'never'],
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
    '@typescript-eslint/require-await': 'error',
    'import/no-default-export': 'error',
    'react/prop-types': 'off',
    'testing-library/await-async-query': 'off',
    'testing-library/no-debugging-utils': [
      'warn',
      {
        utilsToCheckFor: {
          debug: false,
        },
      },
    ],
  },
  root: true,
}
