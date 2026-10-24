# Specs

Each spec describes one piece of behavior: what it must do, what it must not do, and how we check it. Specs are written before the code and kept up to date afterwards, so they always describe the plugin as it is.

## Workflow

1. **Spec.** Copy [`TEMPLATE.md`](TEMPLATE.md) to `specs/NNN-short-name/spec.md` (next free number, kebab-case name). Fill in the problem, the acceptance criteria and what is out of scope. Set `Status: Draft`.
2. **Review.** Agree on the spec before writing code. Open questions go in the spec, not in chat.
3. **Tests.** Write tests from the acceptance criteria. They should fail.
4. **Code.** Implement until the tests pass. Set `Status: Implemented` and link the spec in the pull request.
5. **Change.** When behavior changes later, update the existing spec in the same pull request as the code.

Small fixes that restore behavior a spec already describes only need a test. Refactors, tooling and dependency upgrades need no spec.

## Index

| Spec | Status | Summary |
| --- | --- | --- |
| [001 Settings format](001-settings-format/spec.md) | Implemented | The `@settings` YAML block: parsing, setting types, validation, storage and generated CSS |
