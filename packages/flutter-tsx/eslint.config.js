import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { files: ['**/*.ts'] },
  {
    ignores: [
      'eslint.config.js',
      'dist/',
      'node_modules/',
      'coverage/',
      // Machine-written, gated by tsc + the generated-freshness test.
      'src/generated/',
      'test/site/__generated__/',
    ],
  },
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
            ['^@?(?!(scripts|src|test))\\w'],
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
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      '@typescript-eslint/max-params': ['error', { max: 3 }],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: false },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
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
  // Scoped exceptions last: flat-config order means the general rules above
  // would otherwise re-enable them.
  {
    // Cast-style factory: the type parameter IS the API (callers pin the
    // namespace shape), which this rule cannot see.
    files: ['src/runtime/constants.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
  {
    // TypeScript accepts no other syntax for typing TSX than the JSX
    // namespace, and effect callbacks follow React's void-union contract.
    files: ['src/runtime/jsx-runtime.ts', 'src/runtime/hooks.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
    },
  },
  {
    // Fixtures are user-style code: the DX contract must hold without
    // annotations, so they are linted like an app, not like the library.
    files: ['test/fixtures/**'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
);
