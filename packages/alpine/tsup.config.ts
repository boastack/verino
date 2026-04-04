import { defineConfig } from 'tsup'

export default defineConfig({
  entry:  ['src/index.ts'],
  format: ['esm'],
  dts:    true,
  clean:  true,
  sourcemap: false,
  external: [
    'alpinejs',
    '@verino/core',
    '@verino/core/filter',
    '@verino/core/machine',
    '@verino/core/timer',
    '@verino/core/toolkit',
    '@verino/core/toolkit/controller',
    '@verino/core/toolkit/adapter-policy',
    '@verino/core/toolkit/timer-policy',
    '@verino/core/toolkit/feedback',
    '@verino/core/toolkit/password-manager',
  ],
})
