This is a contributing.md in progress. For now, submit the smallest change you can, and if you can add a test, include a test.

## Local development

Use Node.js 24 and pnpm 10.32.1 (also pinned in `package.json`).
If pnpm is not installed, run `npm install --global pnpm@10.32.1`.

Install the locked dependencies and run the checks:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The existing ESLint 8 / typescript-eslint 5 setup currently fails to load with
TypeScript 7 (`Cannot read properties of undefined (reading 'Undefined')`).
Tests, type checking, and builds can still run; the lint toolchain needs a
separate compatibility update.

Run `pnpm dev` to rebuild when source files change. Reload the plugin in
Obsidian to try the rebuilt files.

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

The browser suite bundles the production settings components, manager, modals,
Pickr and CSS. A small adapter supplies Obsidian's DOM helpers and host controls;
localStorage replaces the vault's data file. Tests cover persistence across page
reloads, cancellation, reset, color formats, invalid input, exclusive pickers,
themed transparency, search, import/export (including JSON files and false/zero
values), configuration removal/restoration and narrow light/dark layouts.
They also fail on unexpected browser errors. The local server starts and stops
automatically; failure traces are saved under `test-results/`.

These tests do not launch Obsidian itself. Still check actual vault reloads,
CSS snippet discovery, installed themes and mobile behavior manually.

Commit `pnpm-lock.yaml` when changing dependencies. Use pnpm for dependency
changes so the project keeps a single lockfile.
