/**
 * CDN bundle builder for Verino.
 *
 * Produces three browser-ready IIFE bundles from the TypeScript sources:
 *
 *   packages/verino/dist/verino.min.js        — vanilla initOTP + window.Verino global
 *   packages/verino/dist/verino-wc.min.js     — <verino-input> web component (auto-registers)
 *   packages/verino/dist/verino-alpine.min.js — Alpine.js adapter (sets window.VerinoAlpine)
 *
 * All are minified, target ES2017 (async/await transpiled), and include an
 * external source map for debugging. Import via CDN:
 *
 *   <script src="https://unpkg.com/verino/dist/verino.min.js"></script>
 *   <!-- const { initOTP, createOTP, filterChar, filterString } = window.Verino -->
 *
 *   <script src="https://unpkg.com/verino/dist/verino-wc.min.js"></script>
 *   <!-- <verino-input length="6"></verino-input> -->
 *
 *   <script src="https://unpkg.com/verino/dist/verino-alpine.min.js"></script>
 *   <!-- document.addEventListener('alpine:init', () => Alpine.plugin(VerinoAlpine)) -->
 *
 * Usage:
 *   node build-cdn.js          # build both bundles
 *   npm run build:cdn          # same via npm
 *   npm run build:all          # tsc + cdn in one step
 */

import esbuild from 'esbuild'

const shared = {
  bundle:    true,
  minify:    true,
  sourcemap: 'external',
  target:    ['es2017'],
  format:    'iife',
  logLevel:  'info',
  banner: {
    js: '/*! Verino | Olawale Balo — Product Designer + Design Engineer */',
  },
}

await Promise.all([
  // Vanilla adapter + core utilities — window.Verino global
  esbuild.build({
    ...shared,
    entryPoints: ['packages/verino/src/cdn.ts'],
    globalName:  'Verino',
    outfile:     'packages/verino/dist/verino.min.js',
  }),

  // Web Component — auto-registers <verino-input>
  esbuild.build({
    ...shared,
    entryPoints: ['packages/web-component/src/index.ts'],
    outfile:     'packages/verino/dist/verino-wc.min.js',
  }),

  // Alpine.js adapter — window.VerinoAlpine plugin
  esbuild.build({
    ...shared,
    entryPoints: ['packages/alpine/src/cdn.ts'],
    outfile:     'packages/verino/dist/verino-alpine.min.js',
  }),
])