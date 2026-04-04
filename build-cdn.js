/**
 * CDN bundle builder for Verino.
 *
 * Produces three browser-ready IIFE bundles from the TypeScript sources:
 *
 *   packages/vanilla/dist/verino.min.js             — vanilla initOTP + window.Verino global
 *   packages/web-component/dist/verino-wc.min.js    — <verino-input> web component (auto-registers)
 *   packages/alpine/dist/verino-alpine.min.js       — Alpine.js adapter (sets window.VerinoAlpine)
 *
 * All are minified, target ES2017 (async/await transpiled), and include an
 * external source map for debugging. Import via CDN:
 *
 *   <script src="https://unpkg.com/@verino/vanilla/dist/verino.min.js"></script>
 *   <!-- const { init } = window.Verino -->
 *
 *   <script src="https://unpkg.com/@verino/web-component/dist/verino-wc.min.js"></script>
 *   <!-- <verino-input length="6"></verino-input> -->
 *
 *   <script src="https://unpkg.com/@verino/alpine/dist/verino-alpine.min.js"></script>
 *   <!-- document.addEventListener('alpine:init', () => Alpine.plugin(VerinoAlpine)) -->
 *
 * Usage:
 *   node build-cdn.js          # build all CDN bundles
 *   npm run build:cdn          # same via npm
 *   npm run build:all          # tsc + cdn in one step
 */

import path from 'node:path'
import { readFile } from 'node:fs/promises'
import esbuild from 'esbuild'

const { version } = JSON.parse(
  await readFile(new URL('./packages/core/package.json', import.meta.url), 'utf8'),
)

const alias = {
  '@verino/core':                           path.resolve('packages/core/src/index.ts'),
  '@verino/core/filter':                    path.resolve('packages/core/src/filter.ts'),
  '@verino/core/machine':                   path.resolve('packages/core/src/machine.ts'),
  '@verino/core/timer':                     path.resolve('packages/core/src/timer.ts'),
  '@verino/core/toolkit':                   path.resolve('packages/core/src/toolkit/index.ts'),
  '@verino/core/toolkit/controller':        path.resolve('packages/core/src/toolkit/controller.ts'),
  '@verino/core/toolkit/adapter-policy':    path.resolve('packages/core/src/toolkit/adapter-policy.ts'),
  '@verino/core/toolkit/timer-policy':      path.resolve('packages/core/src/toolkit/timer-policy.ts'),
  '@verino/core/toolkit/feedback':          path.resolve('packages/core/src/toolkit/feedback.ts'),
  '@verino/core/toolkit/password-manager':  path.resolve('packages/core/src/toolkit/password-manager.ts'),
}

const shared = {
  bundle:    true,
  minify:    true,
  sourcemap: 'external',
  target:    ['es2017'],
  format:    'iife',
  logLevel:  'info',
  alias,
  // Replace process.env.NODE_ENV so the dev-only warning block is dead-code
  // eliminated from the IIFE bundle — browsers have no `process` global.
  define:    { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  banner: {
    js: `/*! Verino v${version} | MIT License | https://github.com/boastack/verino */`,
  },
}

const cdnBuilds = [
  {
    entryPoints: ['packages/vanilla/src/cdn.ts'],
    globalName:  'Verino',
    outfile:     'packages/vanilla/dist/verino.min.js',
  },
  {
    entryPoints: ['packages/web-component/src/cdn.ts'],
    outfile:     'packages/web-component/dist/verino-wc.min.js',
  },
  {
    entryPoints: ['packages/alpine/src/cdn.ts'],
    outfile:     'packages/alpine/dist/verino-alpine.min.js',
  },
]

await Promise.all(cdnBuilds.map((build) => esbuild.build({ ...shared, ...build })))
