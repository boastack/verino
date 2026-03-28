# Changelog

All notable changes to the verino monorepo are documented in this file.
Each package maintains its own changelog inside `packages/`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] - 2026-03-22

### Added

- `verino` — zero-dependency OTP state machine and vanilla DOM adapter. Ships ESM, CJS, declaration maps, source maps, and CDN IIFE bundles.
- `@verino/react` — `useOTP` hook and `HiddenOTPInput` component for React ≥ 18.
- `@verino/vue` — `useOTP` composable for Vue 3 with fully reactive `Ref<T>` state.
- `@verino/svelte` — `useOTP` function with Svelte stores and a `use:action` directive for Svelte ≥ 4.
- `@verino/alpine` — `VerinoAlpine` plugin registering the `x-verino` directive for Alpine.js ≥ 3.
- `@verino/web-component` — `<verino-input>` Shadow DOM custom element; self-registers on import with no peer dependencies.
- pnpm workspace with Turborepo build pipeline; `tsup` produces ESM, CJS, and declaration maps for all packages.
- Jest unit tests and Playwright E2E tests across Chromium, Firefox, WebKit, and Mobile Chrome.
- Bundle size enforcement via `size-limit`; limits are declared in the root `package.json` and checked in CI.
- Versioning and publishing via [Changesets](https://github.com/changesets/changesets).
