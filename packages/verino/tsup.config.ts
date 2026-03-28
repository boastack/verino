import { defineConfig } from 'tsup'

export default defineConfig({
  entry:     [
    'src/index.ts',
    'src/core/index.ts',
    'src/adapters/vanilla.ts',
    'src/adapters/plugins/index.ts',
    'src/adapters/plugins/timer-ui.ts',
    'src/adapters/plugins/web-otp.ts',
    'src/adapters/plugins/pm-guard.ts',
  ],
  format:    ['esm', 'cjs'],
  dts:       { compilerOptions: { composite: false, incremental: false } },
  clean:     true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
})
