import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/plugins/index.ts',
    'src/plugins/timer-ui.ts',
    'src/plugins/web-otp.ts',
    'src/plugins/pm-guard.ts',
  ],
  format:    ['esm'],
  dts:       { compilerOptions: { composite: false, incremental: false } },
  clean:     true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  external: ['@verino/core'],
})
