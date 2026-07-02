// Flat ESLint config (ESLint 9). Extends Expo's shared config and layers on the
// project conventions documented in ../CONVENTIONS.md. Run with `npm run lint`.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'scripts/reset-project.js'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Discourage `any` — prefer a precise type or `unknown`.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Raw console noise; use the shared logger (src/services/logger.ts) instead.
      // warn/error are allowed for genuinely exceptional paths.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Flag unused code (underscore-prefixed args are intentional escape hatch).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Tests may use looser typing and dynamic requires (module mocking).
    files: ['src/__tests__/**/*.{ts,tsx}', 'jest.setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
]);
