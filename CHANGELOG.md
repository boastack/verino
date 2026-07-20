# Changelog

All notable changes to the verino monorepo are documented in this file.
Each package maintains its own changelog inside `packages/`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Drift-resistant, observable timer controllers across every adapter, with independent expiry and resend-cooldown clocks.
- Opt-in deadline-only timer persistence; OTP values are never serialized.
- Injectable haptic/sound effects and cancellable OTP transports while browser Web OTP remains the default.
- Localizable built-in labels, timer, and resend copy in Vanilla, Alpine, and Web Component.
- Accessible timer/resend semantics and complete built-in design-token coverage.
- Added explicit OTP responsibility boundaries, transport requirements, and server-side verification guidance in `SECURITY.md`.

### Changed

- Adopted Creed colors across built-in DOM renderers, examples,
  and documentation, including `#00C65B` success, `#FF3846` invalid,
  `#DBDBDB` resting borders, and consistent `.12` state-ring opacity.

### Fixed

- Package typechecks now run without emitting files, so validation cannot overwrite clean `tsup` release artifacts in `dist`.

---

## [1.0.0] - 2026-04-01

Initial public release of the Verino monorepo.

### Added

- `@verino/core` — pure OTP state machine and shared adapter toolkit; zero DOM, zero dependencies, runs in any JavaScript environment.
- `@verino/vanilla` — DOM adapter with an extensible plugin system; ships three built-in plugins: Web OTP API (SMS autofill), password manager badge guard, and countdown timer with resend UI.
- `@verino/react` — `useOTP` hook and `HiddenOTPInput` component for React ≥ 18.
- `@verino/vue` — `useOTP` composable for Vue 3 with reactive refs and watch-source controlled value.
- `@verino/svelte` — `useOTP` function with Svelte stores and a `use:action` directive for Svelte ≥ 4.
- `@verino/alpine` — `VerinoAlpine` plugin registering the `x-verino` directive for Alpine.js ≥ 3.
- `@verino/web-component` — `<verino-input>` Shadow DOM custom element; self-registers on import with no peer dependencies.
- pnpm workspace with Turborepo build pipeline; `tsup` produces ESM, CJS, and declaration maps for all packages.
- Jest unit tests and Playwright E2E tests across Chromium, Firefox, WebKit, and Mobile Chrome.
- Bundle size enforcement via `size-limit`; limits are declared in the root `package.json` and checked in CI.
- Versioning and publishing via [Changesets](https://github.com/changesets/changesets).
