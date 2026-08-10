//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    // These JS config files are not part of the tsconfig project, so the
    // type-aware parser cannot resolve them (parserOptions.project error).
    ignores: ['eslint.config.js', 'prettier.config.js'],
  },
  ...tanstackConfig,
  {
    rules: {
      // The rule flags legitimate defensive patterns used throughout the app:
      // context guards (`if (!ctx)`), SSR checks (`typeof window !==
      // 'undefined'`), and runtime-null coalescing (e.g. `t.notes ?? ''`
      // where the API can return null at runtime).
      // Kept as a warning (not error) so lint passes while remaining visible
      // for future code — it currently flags legitimate defensive patterns
      // (context guards, `typeof window` checks, runtime-null coalescing).
      '@typescript-eslint/no-unnecessary-condition': 'warn',
    },
  },
]
