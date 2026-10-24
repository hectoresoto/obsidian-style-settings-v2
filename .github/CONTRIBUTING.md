This is a contributing.md in progress. For now, submit the smallest change you can, and if you can add a test, include a test.

## Local development

Use Node.js 26 (`engines` in `package.json`) and pnpm 10.32.1 (`packageManager` in `package.json`). If pnpm is not installed, run `npm install --global pnpm@10.32.1`.

Install the locked dependencies and run the checks:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

ESLint uses `eslint.config.mjs` (flat config) and checks all TypeScript/TSX sources under `src/`. `pnpm lint:fix` checks the same files and applies available fixes. Both commands fail on errors or warnings. Formatting is handled by Prettier, configured under the `prettier` key in `package.json`.

TypeScript 7.0 does not expose the legacy compiler API needed by typescript-eslint. Following Microsoft's side-by-side setup, `typescript` aliases the official `@typescript/typescript6` compatibility package, while `@typescript/native` aliases TypeScript 7.0.2 and supplies `tsc`. Thus `pnpm typecheck` and `pnpm build` still use TypeScript 7; ESLint uses the supported TypeScript 6 API without forced peers or suppressed compatibility warnings. `pnpm exec tsc --version` verifies the compiler.

See [Microsoft's compatibility guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).

Run `pnpm dev` to rebuild when source files change. Reload the plugin in Obsidian to try the rebuilt files.

## Project layout

```
src/
  main.ts            Plugin entry point
  Utils.ts           Shared helpers (parsing, titles, descriptions)
  settings/          Settings logic without UI: types, validation, manager, style generation
  color/             Color validation and color picker helpers
  modals/            Import and export modals
  settingsView/      Settings tab, side view and their markup
    components/      One component per setting type
  lang/              Translations
  css/               Plugin styles
tests/
  browser/           Playwright regression tests
  tooling/           Lint configuration tests
  *.config.mjs       Vitest and Playwright settings
scripts/             Build and release scripts
docs/                Theme author guide, CSS snippet, screenshots and release notes
patches/             Fixes applied to dependencies on install
```

Unit tests (`*.test.ts`) live next to the file they test.

The project root only keeps files that Obsidian or the tools look for there: `manifest.json` and `versions.json` for Obsidian, plus `package.json`, the pnpm files, `tsconfig.json` and `eslint.config.mjs`. `pnpm build` and `pnpm dev` write `main.js` and `styles.css` to the root, where Obsidian loads them; both are generated from `src/` and ignored by git. Releases attach freshly built copies.

## Style generation boundary

`src/settings/StyleGenerator.ts` converts saved settings, configuration and a snapshot of theme variables into CSS, base/light/dark variable lists and diagnostic messages. It does not read browser globals, access Obsidian, persist settings or log warnings. The original color conversion and CSS serialization behavior is covered by compatibility snapshots captured before extraction.

`CSSSettingsManager` owns host operations: reading gradient endpoints from the theme, saving settings, applying CSS to the style element, logging diagnostics and notifying Obsidian. Shared data types live in `src/settings/SettingsTypes.ts`; shared color validation lives in `src/color/ColorUtils.ts`. Existing manager and utility import paths re-export those helpers/types for compatibility.

## Browser regression tests

Install Chromium once, then run the interaction tests:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

On Windows, an installed Edge can be used without downloading Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
pnpm test:browser
```

The browser suite bundles the production settings components, manager, modals, Pickr and CSS. A small adapter supplies Obsidian's DOM helpers and host controls; localStorage replaces the vault's data file. Tests cover persistence across page reloads, cancellation, reset, color formats, invalid input, exclusive pickers, themed transparency, search, import/export (including JSON files and false/zero values), configuration removal/restoration and narrow light/dark layouts. They also fail on unexpected browser errors. The local server starts and stops automatically; failure traces are saved under `tests/test-results/`.

These tests do not launch Obsidian itself. Still check actual vault reloads, CSS snippet discovery, installed themes and mobile behavior manually.

## GitHub Actions

`.github/workflows/ci.yml` runs on branch pushes and pull requests, and supports manual runs once the workflow is on the default branch. It uses a standard Ubuntu 24.04 runner, Node.js 26 and the pnpm version declared in `package.json`.

The `Tests, types and build` check installs the frozen lockfile, runs unit tests, lints sources, checks types, builds the plugin, installs Chromium with its system dependencies, and runs the browser regressions. Browser failures are annotated in GitHub. Open the repository's **Actions** tab or a pull request's **Checks** tab to view the results and individual step logs.

An updated push cancels an older run for the same branch or pull request. Each job has a 15-minute limit. The workflow has read-only repository access and does not upload artifacts or enable dependency caching. Standard hosted runner execution is free for public repositories.

These checks report failures; making them mandatory before merging requires a separate repository ruleset or branch protection setting.

Commit `pnpm-lock.yaml` when changing dependencies. Use pnpm for dependency changes so the project keeps a single lockfile.

## Versioning and releases

The plugin uses [semantic versioning](https://semver.org). The fork's own releases start at `2.0.0`, which keeps them above the original plugin's versions while both share the `obsidian-style-settings` id.

Pick the next version from what changed, using the specs in `specs/`:

| Change | Version | Example |
| --- | --- | --- |
| Breaks a contract a spec defines, such as the `@settings` format, storage keys or generated CSS | Major | Renaming a setting field that existing themes use |
| Adds behavior: a new spec or new acceptance criteria | Minor | A new setting type |
| Makes the code meet a spec that already exists | Patch | Fixing a color format that outputs the wrong value |

`package.json` holds the version. `manifest.json` and `versions.json` follow it: the `version` script in `package.json` runs `scripts/version-bump.mjs`, which copies the version into `manifest.json` and adds it to `versions.json` with the current `minAppVersion`. Never edit those versions by hand.

To release, merge the changes into `main`, then on an up-to-date, clean `main`:

```sh
npm version patch   # or minor, or major
git push --follow-tags
```

`npm version` is used because pnpm 10 has no version command; it does not touch dependencies or the lockfile. It updates the three files, commits them with the version as the message, and creates a tag such as `2.0.1`. `.npmrc` removes the default `v` prefix because Obsidian requires the tag to match the manifest version exactly.

Pushing the tag starts `.github/workflows/release.yml`. It checks that the tag matches `package.json`, `manifest.json` and `versions.json`, runs the unit tests, builds the plugin and publishes a GitHub release with `main.js`, `manifest.json` and `styles.css` attached and release notes generated from the merged pull requests. These are the files users download to install the plugin by hand.

To change the minimum Obsidian version, edit `minAppVersion` in `manifest.json` before running `npm version`.

`docs/release-notes.md` holds the notes of the last upstream release and is no longer updated; release notes now live on the GitHub releases page.

## Patched dependencies

`patches/@simonwep__pickr@1.8.4.patch` changes the bundled `dist/pickr.min.js` so Pickr's sliders and palette track the mouse and arrow keys, and the picker closes on Escape or an outside click, on the document that owns the picker. Obsidian opens settings in popout windows that share the main window's JavaScript, so listeners on the global `document` never receive events from those windows. pnpm applies the patch on install (see `patchedDependencies` in `pnpm-workspace.yaml`).

`pnpm patch` does not support Pickr's tarball dependency, so edit the patch by hand. If Pickr's version or tarball changes, regenerate the patch or remove it, and run the browser tests: `?popout` renders the settings in a same-origin iframe to reproduce the popout window.
