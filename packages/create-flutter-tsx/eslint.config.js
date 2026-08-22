import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { files: ['**/*.ts'] },
  { ignores: ['eslint.config.js', 'dist/', 'node_modules/', 'coverage/'] },
  {
    languageOptions: {
      globals: { ...globals.node, Bun: 'readonly' },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  eslintPluginPrettierRecommended,
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'],
            ['^node:'],
            ['^@?(?!(src))\\w'],
            ['^'],
            ['^\\.'],
          ],
        },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/max-params': ['error', { max: 3 }],
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: false },
      ],
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/prefer-destructuring': [
        'error',
        { array: false, object: true },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'func-style': ['error', 'expression'],
      'max-params': 'off',
      'no-duplicate-imports': 'error',
      'no-useless-return': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-destructuring': 'off',
      'prefer-promise-reject-errors': 'off',
    },
  },
);
