import { defineConfig } from 'tsup'

export default defineConfig({
  entry:  ['src/index.tsx'],
  format: ['esm', 'cjs'],
  dts:    true,
  clean:  true,
  sourcemap: false,
  external: ['react', '@verino/core'],
})
