import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tsParser from '@typescript-eslint/parser'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'node_modules/',
    'node_modules_*/',
    'node_modules_old*/',
    'node_modules_broken*/',
    'dist',
    'dist/',
    'release/',
    'check-syntax.js',
    'check_syntax.js',
    'read_css.js',
    'read_wav.js',
    'temp_brace_count.js',
    '**/*.d.ts',
    // Large monolithic file currently exceeds Babel's 500KB codegen threshold in editor linting.
    'src/App.jsx',
  ]),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['validate-jsx.js', 'scripts/**/*.js', 'electron/**/*.cjs', '*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
