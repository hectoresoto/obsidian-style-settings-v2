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

Commit `pnpm-lock.yaml` when changing dependencies. Use pnpm for dependency
changes so the project keeps a single lockfile.
