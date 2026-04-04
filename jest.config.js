export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@verino/core$':                              '<rootDir>/packages/core/src/index.ts',
    '^@verino/core/filter$':                       '<rootDir>/packages/core/src/filter.ts',
    '^@verino/core/machine$':                      '<rootDir>/packages/core/src/machine.ts',
    '^@verino/core/timer$':                        '<rootDir>/packages/core/src/timer.ts',
    '^@verino/core/toolkit$':                      '<rootDir>/packages/core/src/toolkit/index.ts',
    '^@verino/core/toolkit/controller$':           '<rootDir>/packages/core/src/toolkit/controller.ts',
    '^@verino/core/toolkit/adapter-policy$':       '<rootDir>/packages/core/src/toolkit/adapter-policy.ts',
    '^@verino/core/toolkit/timer-policy$':         '<rootDir>/packages/core/src/toolkit/timer-policy.ts',
    '^@verino/core/toolkit/feedback$':             '<rootDir>/packages/core/src/toolkit/feedback.ts',
    '^@verino/core/toolkit/password-manager$':     '<rootDir>/packages/core/src/toolkit/password-manager.ts',
    '^@verino/vanilla$':        '<rootDir>/packages/vanilla/src/index.ts',
    '^@verino/react$':          '<rootDir>/packages/react/src/index.tsx',
    '^@verino/vue$':            '<rootDir>/packages/vue/src/index.ts',
    '^@verino/svelte$':         '<rootDir>/packages/svelte/src/index.ts',
    '^@verino/alpine$':         '<rootDir>/packages/alpine/src/index.ts',
    '^@verino/web-component$':  '<rootDir>/packages/web-component/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: './tsconfig.test.json' }],
    '^.+\\.js$':   ['ts-jest', { useESM: true }],
  },
  // svelte/* ships ESM-only; allow Jest to transform it so imports don't fail.
  // The pattern must exclude BOTH /node_modules/.pnpm/svelte@... AND
  // /node_modules/.pnpm/svelte@.../node_modules/svelte/ (pnpm double-nesting).
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm/svelte|svelte/)'],
  modulePathIgnorePatterns: [],
  // Playwright spec files live in tests/e2e/ and must not be picked up by Jest.
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  // Collect coverage from all published packages.
  // helpers/feedback.ts is excluded: triggerHapticFeedback / triggerSoundFeedback rely on
  // navigator.vibrate and AudioContext — browser APIs unavailable in Node. The
  // try/catch paths are exercised but the happy paths can never execute in Jest.
  // CDN entry points (cdn.ts) are thin wrappers that re-export and assign globals
  // — they are excluded because they cannot be tested in a jsdom/Node environment.
  collectCoverageFrom: [
    'packages/core/src/**/*.ts',
    'packages/vanilla/src/**/*.ts',
    'packages/react/src/**/*.tsx',
    'packages/vue/src/**/*.ts',
    'packages/svelte/src/**/*.ts',
    'packages/alpine/src/**/*.ts',
    'packages/web-component/src/**/*.ts',
    '!packages/core/src/toolkit/feedback.ts',
    '!packages/core/src/**/*.d.ts',
    '!packages/vanilla/src/**/*.d.ts',
    '!packages/alpine/src/cdn.ts',
    '!packages/web-component/src/cdn.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 97.9,
      branches:   89.5,
      functions:  95,
      lines:      99,
    },
    './packages/core/src/': {
      statements: 100,
      branches:   100,
      functions:  100,
      lines:      100,
    },
  },
}
