import { defineConfig } from 'tsup'

export default defineConfig({
  entry:     [
    'src/index.ts',
    'src/toolkit/index.ts',
    'src/toolkit/feedback.ts',
    'src/toolkit/password-manager.ts',
    'src/toolkit/timer-policy.ts',
    'src/toolkit/controller.ts',
    'src/toolkit/adapter-policy.ts',
    'src/filter.ts',
    'src/timer.ts',
    'src/machine.ts',
  ],
  format:    ['esm', 'cjs'],
  dts:       { compilerOptions: { composite: false, incremental: false } },
  clean:     true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
})
