# Contributing to Verino

First off — **thank you**. Whether you're fixing a typo, reporting a bug, or adding a whole new framework adapter, every contribution matters and is genuinely appreciated. Verino is built for the entire web development community, and it gets better because of people like you.

This guide covers everything you need to know to contribute. Don’t worry if this is your first open source contribution, we’ll walk you through it.

---

## Ways to Contribute

Contributing doesn't have to mean writing code. Here are all the ways you can help:

**Report bugs** — If something isn't working as expected, [open a bug report](https://github.com/boastack/verino/issues/new?template=bug_report.yml). A clear reproduction is the most valuable thing you can give.

**Suggest features** — Have an idea that would make Verino more useful? [Open a feature request](https://github.com/boastack/verino/issues/new?template=feature_request.yml). We read every one.

**Improve documentation** — Spotted something unclear, missing, or wrong in the docs? Documentation PRs are always welcome and often the most impactful contributions.

**Write examples** — Real-world usage examples help everyone. If you've built something interesting with Verino, consider contributing it to the examples directory.

**Fix typos** — Yes, typo PRs are genuinely welcome. Good docs matter.

**Add framework support** — Want Verino in a framework we don't support yet? [Open a framework request](https://github.com/boastack/verino/issues/new?template=framework_request.yml) first to discuss, then we'd love your help building it.

**Sponsor the project** — Verino is solo maintained. If it saves you time on your project, [consider sponsoring](https://github.com/sponsors/boastack). It keeps the lights on and the library MIT licensed.

---

## Development Setup

### Prerequisites

- **Node.js** 18 or higher
- **Node.js 20 LTS** is the recommended local development version
- **pnpm** 10 or higher — the repo is pinned to `pnpm@10.13.1`
- **Git**

### Clone and Install

```bash
git clone https://github.com/boastack/verino.git
cd verino
pnpm i
```

### Project Structure

```
verino/
├── packages/
│   ├── core/          ← @verino/core
│   ├── vanilla/       ← @verino/vanilla
│   ├── react/         ← @verino/react
│   ├── vue/           ← @verino/vue
│   ├── svelte/        ← @verino/svelte
│   ├── alpine/        ← @verino/alpine
│   └── web-component/ ← @verino/web-component
├── tests/             ← Jest unit tests, SSR tests, and Playwright E2E tests
├── examples/          ← runnable examples for each framework
├── .github/           ← this folder
├── turbo.json
└── pnpm-workspace.yaml
```

### Development Commands

```bash
pnpm build          # build all packages → dist/
pnpm build:cdn      # build IIFE CDN bundles (verino.min.js + verino-wc.min.js + verino-alpine.min.js)
pnpm build:all      # build packages + CDN bundles
pnpm typecheck      # type-check all packages without emitting
pnpm test           # run all Jest unit tests
pnpm test:coverage  # run Jest with coverage
pnpm test:watch     # run tests in watch mode
pnpm test:e2e       # run Playwright browser tests
pnpm size           # check bundle-size budgets
```

---

## Making Changes

Before changing adapter behavior, read the [adapter policy](../docs/ADAPTER_POLICY.md). Shared rows must land through `@verino/core` or `@verino/core/toolkit` first; adapter-local exceptions must be documented and tested in the same PR.

### Branching

Always branch from `main`. Use these naming conventions:

```
fix/describe-the-bug
feat/describe-the-feature
docs/what-you-changed
chore/what-you-did
refactor/what-you-refactored
```

Examples:
```
fix/timer-not-restarting-on-reset
feat/add-select-on-focus-option
docs/add-vue-controlled-value-example
```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). This keeps the changelog clean and makes releases automated.

```
feat: add masked mode support
fix: password manager detection on Firefox
docs: add Vue controlled value example
chore: update esbuild to 0.20
refactor: simplify filterChar logic
test: add paste with transformer tests
```

The format is: `type: short description in present tense`

---

## Testing

Tests live in `/tests/`. There are two suites:

**Unit tests (Jest)** — test the core state machine and vanilla DOM adapter:

```bash
pnpm test                          # run all Jest tests
pnpm test -- --testNamePattern="paste"   # run tests matching a name
pnpm test -- --no-coverage         # skip coverage report
```

**E2E tests (Playwright)** — test real browser behavior:

```bash
pnpm test:e2e                      # all browsers
npx playwright test --project=chromium   # Chromium only
npx playwright test tests/vanilla.spec.ts  # one file
```

**What to test:**

- Write unit tests for any new core machine behavior
- Write or update tests for any option/callback you add
- If you change the vanilla DOM adapter, add tests to `vanilla.unit.test.ts`
- Run the full suite before submitting your PR, zero tolerance for regressions
- Test in Chrome, Firefox, and Safari if your change touches browser APIs

Framework adapters (React, Vue, Svelte) each have unit tests focused on adapter-specific behaviour (hook integration, reactive updates). Input logic is fully covered by `tests/core.test.ts`.

---

## Changesets

This monorepo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

- If your change affects a published package, run `pnpm changeset`
- If the change should not publish a package, run `pnpm changeset --empty`
- CI will fail if package changes are merged without a changeset

---

## Submitting a Pull Request

1. **Fork** the repository and create your branch from `main`
2. **Make your changes** — see the sections below for specific guidance
3. **Write tests** for new behavior
4. **Run `pnpm changeset`** if your change affects a published package
5. **Run `pnpm test`** — all tests must pass
6. **Run `pnpm build`** — build must succeed with no TypeScript errors
7. **Run `pnpm typecheck`** — strict mode, no errors allowed
8. **Push** your branch and [open a pull request](https://github.com/boastack/verino/compare)
9. **Fill out the PR template** completely — the more context you provide, the faster the review
10. **Wait for review** — we aim to respond within 48 hours
11. **Address feedback** — be patient, reviews are thorough
12. **Merge!** 🎉

---

## Adding Framework Support

New framework adapters are very welcome! Before writing code, please [open a framework request issue](https://github.com/boastack/verino/issues/new?template=framework_request.yml) to discuss the approach. This saves everyone time.

Requirements for a new framework package:

- Builds on the shared core option fragments from `@verino/core` and documents any adapter-specific contracts explicitly
- Exports a composable/hook/directive with the same API shape as existing adapters
- Includes a `README.md` with full usage documentation
- Passes a set of usage tests
- Has a working example in `/examples/`
- Peer dependency on the framework (not bundled)

---

## Documentation Contributions

Documentation is just as important as code. If something is unclear or missing, please fix it.

- Package docs live in each `packages/*/README.md`
- Root `README.md` is the monorepo overview (GitHub landing page)
- Run `pnpm build` after docs changes to ensure nothing broke
- Follow existing structure — heading levels, table format, code block language tags

---

## Code Style

The codebase is TypeScript strict. A few things to keep in mind:

- **No `any`** — use proper types or `unknown` with narrowing
- **No unused variables** — `pnpm typecheck` should fail on these, and reviews should keep the codebase clean
- **Explicit `.js` extensions** on all intra-package imports (the package is `"type": "module"`)
- **JSDoc comments** on all exported public APIs
- **No DOM imports in the pure machine/filter/timer modules under `packages/core/src/`** — browser-only code belongs in `packages/core/src/toolkit/`
- **No cross-adapter imports** — each adapter package imports only from `@verino/core`

---

## Getting Help

Stuck? Have a question about how to approach something?

- **[GitHub Discussions](https://github.com/boastack/verino/discussions)** — best place for questions about contributing
- **[GitHub Issues](https://github.com/boastack/verino/issues)** — bugs and feature requests only
- **[@boastack on Twitter](https://twitter.com/boastack)** — quick questions
- Be patient — Verino is solo maintained alongside a day job

---

## Recognition

Every contributor is recognized:

- Added to the **GitHub contributors** page automatically
- Credited in **changelog release notes** for the version that includes your change
- Thanked personally in the PR review

No contribution is too small. The people who fix typos matter just as much as the people who add features.

---

Thank you again for taking the time to contribute to Verino. Open source is built by people who care enough to show up, and you showing up here means a lot.

— Olawale Balo ([@walebuilds](https://github.com/walebuilds))