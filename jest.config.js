export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^verino$':          '<rootDir>/packages/verino/src/index.ts',
    '^verino/core$':     '<rootDir>/packages/verino/src/core/index.ts',
    '^@verino/react$':   '<rootDir>/packages/react/src/index.tsx',
    '^@verino/vue$':     '<rootDir>/packages/vue/src/index.ts',
    '^@verino/svelte$':  '<rootDir>/packages/svelte/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: './tsconfig.test.json' }],
    '^.+\\.js$':   ['ts-jest', { useESM: true }],
  },
  // svelte/* ships ESM-only; allow Jest to transform it so imports don't fail.
  // The pattern must exclude BOTH /node_modules/.pnpm/svelte@... AND
  // /node_modules/.pnpm/svelte@.../node_modules/svelte/ (pnpm double-nesting).
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm/svelte|svelte/)'],
  // Prevent jest-haste-map from seeing the monorepo root package.json (also
  // named "verino") alongside packages/verino/package.json — duplicate names
  // cause a hard error in jest-haste-map 30+.
  modulePathIgnorePatterns: ['<rootDir>/package.json'],
  // Playwright spec files live in tests/e2e/ and must not be picked up by Jest.
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  // Collect coverage from the core + vanilla adapter (framework adapters require
  // peer deps not installed in the test environment and are excluded).
  collectCoverageFrom: [
    'packages/verino/src/**/*.ts',
    '!packages/verino/src/**/*.d.ts',
  ],
  coverageThreshold: {
    './packages/verino/src/core/': {
      statements: 100,
      branches:   100,
      functions:  95,
      lines:      100,
    },
  },
}
