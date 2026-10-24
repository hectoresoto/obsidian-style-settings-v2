# Obsidian Style Settings (fork)

Obsidian plugin that reads `/* @settings ... */` YAML blocks from theme, snippet and plugin CSS and shows them as controls that toggle `body` classes or set CSS variables. `README.md` is for end users and is written for people who do not code; the `@settings` format guide for theme and snippet authors is `docs/theme-authors.md`; contributor setup, project layout and CI details live in `.github/CONTRIBUTING.md`.

## Commands

Use pnpm (version pinned in `package.json`) and Node.js 26.

```sh
pnpm test          # unit tests (vitest)
pnpm test:browser  # Playwright regressions (needs `pnpm exec playwright install chromium`)
pnpm lint          # ESLint, fails on warnings
pnpm typecheck     # TypeScript 7 via @typescript/native
pnpm build         # typecheck + production bundle
```

Run `pnpm test`, `pnpm lint` and `pnpm typecheck` before considering a change done.

## Conventions

- Prettier: tabs, single quotes, ES5 trailing commas (`pnpm prettier`).
- Unit tests (`*.test.ts`) live next to the file they test.
- `src/settings/` has no UI: types, validation, manager, style generation. `StyleGenerator.ts` must stay free of browser globals and Obsidian APIs.
- User-visible strings go through `src/lang/` translations.
- Change dependencies with pnpm only and commit `pnpm-lock.yaml`.
- Never edit the version in `manifest.json` or `versions.json` by hand; releases use `npm version` (see "Versioning and releases" in `.github/CONTRIBUTING.md`).

## Spec-driven development

Specs in `specs/` describe what the plugin does; code and tests follow from them.

- Before changing behavior (new feature, bug fix that changes output, format change), create or update the spec first. See `specs/README.md`.
- New work: copy `specs/TEMPLATE.md` to `specs/NNN-short-name/spec.md`, using the next free number.
- Turn each acceptance criterion into at least one test before writing the code.
- If code and spec disagree, stop and ask whether the spec or the code is wrong; do not silently change either.
- Refactors, tooling and dependency upgrades that do not change behavior need no spec.

`specs/001-settings-format/spec.md` is the baseline contract for the `@settings` format. Any change to parsing, validation, storage keys or generated CSS must update it.
