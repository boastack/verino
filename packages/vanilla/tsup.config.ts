import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    vanilla: 'src/vanilla.ts',
    'plugins/timer-ui': 'src/plugins/timer-ui.ts',
    'plugins/web-otp': 'src/plugins/web-otp.ts',
    'plugins/pm-guard': 'src/plugins/pm-guard.ts',
  },
  format:    ['esm'],
  dts:       { compilerOptions: { composite: false, incremental: false } },
  clean:     true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  external: [
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
