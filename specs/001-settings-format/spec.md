# 001 Settings format

- **Status:** Implemented (baseline written from the code at commit `7b1d561`; open questions resolved, see [Decisions](#decisions))
- **Related:** `docs/theme-authors.md` (author guide), `src/main.ts`, `src/settings/`

This spec records the `@settings` format as the plugin implements it today. Theme and snippet authors depend on this contract, so changes must be deliberate and backwards compatible unless a spec says otherwise. Where the author guide disagrees with the code, see [Known discrepancies](#known-discrepancies).

## Problem

Themes, CSS snippets and plugins need a way to expose configurable options without shipping their own settings UI. Style Settings reads a YAML block embedded in their CSS, renders controls for it, stores the user's choices and applies them as `body` classes or CSS custom properties.

## Expected behavior

### Discovery and parsing

- **AC-1:** Given a stylesheet loaded by Obsidian, when its text contains a comment that starts with `/*` or `/*!`, optional whitespace, `@settings` and a line break, then the comment body up to the next `*/` is parsed as YAML.
- **AC-2:** Given a stylesheet with several `@settings` comments, when it is parsed, then each comment produces its own section.
- **AC-3:** Given a block whose YAML uses tabs, when it is parsed, then tabs are replaced with the block's detected space indentation (four spaces if none is detected) before loading.
- **AC-4:** Given YAML that uses merge keys (`<<: *anchor`), when it is parsed, then the merge is applied (js-yaml `CORE_SCHEMA` plus `mergeTag`).
- **AC-5:** Given a parsed block, when it lacks `name`, `id`, or a non-empty `settings` list, then it is ignored and no section is shown.
- **AC-6:** Given `null` entries in `settings` (for example a stray `-`), when the block is parsed, then those entries are dropped.
- **AC-7:** Given YAML that fails to load, when the stylesheet is parsed, then the error is added to the error list shown to the user, labeled with the `name:` line of that block (or, if the block has none, the first `name:` line found in the stylesheet), and the other blocks and stylesheets still load.
- **AC-8:** Given a plugin that calls `app.workspace.trigger('parse-style-settings')`, or a `css-change` event from any source other than Style Settings itself, when the event fires, then all stylesheets are parsed again.

### Section fields

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Section title shown as the top-level heading |
| `id` | yes | Section id; prefix of every storage key in the section. Several blocks may share it (AC-27) |
| `settings` | yes | List of setting definitions |
| `collapsed` | no | Initial collapsed state of the section, defaults to `true` |

### Common setting fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Unique within the section id, across all blocks that share it (AC-28). Used as the class name or CSS variable name |
| `type` | yes | One of the eleven types below |
| `title` | yes | Label shown in the UI |
| `description` | no | Help text under the label |
| `title.<lang>`, `description.<lang>` | no | Translation for Obsidian's current language; falls back to `title`/`description`. Supported codes: `ar cz da de es fr hi id it ja ko nl no pl pt pt-BR ro ru sq tr uk zh zh-TW` |

- **AC-9:** Given a setting with `title.<lang>` for Obsidian's current language, when it is rendered, then the translated title is shown; otherwise `title` is shown. The same applies to `description`.

### Setting types

Every setting is passed through `validateAndNormalizeSetting`. Validation never rejects a setting: it fills in or corrects values and emits warnings with a code. Warnings appear in the error list as `[CODE] message`.

| Type | Fields | Effect | Normalization (warning code) |
| --- | --- | --- | --- |
| `heading` | `level` 1–6, `collapsed?` | Groups the following settings | Missing, non-integer or out-of-range `level` is rounded and clamped to 1–6; missing becomes 1 (`INVALID_HEADING_LEVEL`). Level 0 is reserved for the implicit section heading (AC-11), so a `level: 0` in a block becomes 1 |
| `info-text` | `markdown?` | Shows `description`, rendered as Markdown when `markdown: true` | None |
| `class-toggle` | `default?` bool, `addCommand?` | Adds class `id` to `body` when on | Non-boolean `default` becomes `false` (`INVALID_DEFAULT`) |
| `class-select` | `options`, `allowEmpty`, `default?` | Adds the selected option's value as a class on `body` | Missing `allowEmpty` becomes `false` (`MISSING_ALLOW_EMPTY`); `default` not in `options` warns and is kept (`INVALID_DEFAULT`) |
| `variable-text` | `default`, `quotes?` | `--id: <text>` | Missing `default` becomes `''` (`MISSING_DEFAULT`) |
| `variable-number` | `default`, `format?` | `--id: <number><format>` | Missing or non-numeric `default` becomes `0` (`MISSING_DEFAULT`) |
| `variable-number-slider` | `default`, `min`, `max`, `step`, `format?` | `--id: <number><format>` | Missing fields become `0/0/100/1` (`MISSING_SLIDER_FIELDS`); `min > max` swaps them (`INVALID_SLIDER_RANGE`); `step <= 0` becomes `1` (`INVALID_SLIDER_STEP`); `default` is clamped to the range (`INVALID_SLIDER_DEFAULT`) |
| `variable-select` | `options`, `default`, `quotes?` | `--id: <value>` | Missing `default` becomes `''` (`MISSING_DEFAULT`); `default` not in `options` warns and is kept (`INVALID_DEFAULT`) |
| `variable-color` | `format`, `default?`, `opacity?`, `alt-format?` | One or more color variables | Missing `format` becomes `hex` (`MISSING_COLOR_FORMAT`); unknown `format` becomes `hex` (`UNSUPPORTED_COLOR_FORMAT`); a `default` not starting with `#`, `rgb` or `hsl` warns and is kept (`INVALID_DEFAULT`) |
| `variable-themed-color` | `format`, `default-light`, `default-dark`, `opacity?`, `alt-format?` | Color variables per theme | Same format rules as `variable-color`; a missing default becomes `#000000` (`MISSING_THEMED_COLOR_FIELDS`); invalid defaults warn and are kept (`INVALID_DEFAULT`) |
| `color-gradient` | `from`, `to`, `format`, `step`, `pad?` | `--id-<n>` for n = 0..100 in multiples of `step` | Missing fields become `''`, `''`, `hex`, `1` (`MISSING_GRADIENT_FIELDS`); format other than `hex/hsl/rgb` becomes `hex` (`UNSUPPORTED_GRADIENT_FORMAT`); `step <= 0` becomes `1` (`INVALID_GRADIENT_STEP`) |

Unknown `type` values pass through validation unchanged.

`options` entries are either a string (used as label and value) or `{ label, value }`.

Color formats: `hex`, `rgb`, `rgb-values`, `rgb-split`, `hsl`, `hsl-values`, `hsl-split`, `hsl-split-decimal`. Output for each format, with and without `opacity`, is documented in the author guide and fixed by the compatibility snapshots in `src/settings/__snapshots__/StyleGenerator.test.ts.snap`.

- **AC-10:** Given a setting with an invalid field covered by the table above, when it is validated, then the field is corrected as described and one warning with the listed code is returned.
- **AC-11:** Given headings, when the section is rendered, then each setting belongs to the closest preceding heading, and a heading nests under the closest preceding heading with a lower `level`. The section `name` acts as an implicit level-0 heading.
- **AC-12:** Given a `class-toggle` with `addCommand: true`, when settings load, then a command `style-settings-class-toggle-<sectionId>-<id>` named `Toggle <title>` is registered and flips the class.
- **AC-13:** Given a `class-select` with `allowEmpty: true`, when it is rendered, then the dropdown includes an empty option whose stored value is `none`, which adds no class.

### Storage

- **AC-14:** Given a user change, when it is saved, then it is stored in the plugin data under `<sectionId>@@<settingId>`. Themed colors use `<sectionId>@@<settingId>@@light` and `<sectionId>@@<settingId>@@dark`.
- **AC-15:** Given saved values, when the configuration is reloaded and a section still exists but one of its setting ids is gone, then the saved values for that setting are deleted.
- **AC-16:** Given saved values, when a whole section disappears (for example the snippet is disabled), then its saved values are kept and apply again when the section returns.
- **AC-17:** Given a reset of one setting or a whole section, when it runs, then the matching keys are removed from the plugin data.

### Generated CSS

- **AC-18:** Given saved values, when styles are generated, then a single `<style id="css-settings-manager">` contains three rules: `body.css-settings-manager`, `body.theme-light.css-settings-manager` and `body.theme-dark.css-settings-manager`, holding the base, light and dark variables respectively.
- **AC-19:** Given a setting with no saved value, when styles are generated, then no variable is emitted for it. Defaults are expected to be defined by the theme or snippet itself; the plugin only emits overrides.
- **AC-20:** Given a `class-toggle` with no saved value and `default: true`, or a `class-select` with no saved value and a `default`, when classes are applied, then the default class is added to `body`. (Unlike variables, class defaults are applied by the plugin.)
- **AC-21:** Given a `variable-text` or `variable-select` with `quotes: true`, when its value is emitted, then it is wrapped in single quotes, except an empty value (`""`), which is emitted as nothing.
- **AC-22:** Given text typed into a `variable-text` control, when it is saved, then `;`, `<` and `>` are removed, and an empty string is stored as `""`.
- **AC-23:** Given a saved color that does not start with `#`, `rgb` or `hsl`, or that contains `NaN`, when styles are generated, then no variable is emitted for it and a diagnostic is logged to the console.
- **AC-24:** Given a `color-gradient`, when styles are generated, then the gradient is emitted if `from` is the id of a saved `variable-color` or `variable-themed-color` in the gradient's own section id. The `to` color is a saved color with that id in the same section id, or else the theme's current value of `--<to>`. Base, light and dark gradients are resolved separately from base, light and dark saved colors. If `from` or `to` cannot be resolved, that gradient is omitted. Saved colors of other section ids are never used, even when their setting id matches.
- **AC-25:** Given gradient generation, when `pad` is set, then the step number is left-padded with zeros to `pad` digits (`--id-005`).

### Labels and duplicate ids

- **AC-26:** Given a block that loads with validation warnings, when the stylesheet is parsed, then each warning is labeled with that block's own `name`, not the first `name:` in the stylesheet.
- **AC-27:** Given two or more blocks with the same section `id`, in one stylesheet or in several, when the configuration is built, then their settings are merged under that id: every setting keeps its saved value, generates CSS and is not pruned by AC-15. Each block still appears in the UI under its own `name`, and resetting any of them resets every setting stored under that id.
- **AC-28:** Given a setting `id` defined more than once under the same section id (within one block or across blocks that share the section id), other than `heading` and `info-text` settings, when the stylesheets are parsed, then a `DUPLICATE_SETTING_ID` warning is added, labeled with the block that holds the later definition, and the later definition is the one used for storage and CSS.

## Out of scope

- The settings UI layout and styling beyond the behavior above.
- Import/export file format (should get its own spec).
- Color picker interaction (covered by browser tests and the Pickr patch).

## Design notes

| Concern | Location |
| --- | --- |
| Block regex, `name:` lookup, YAML loading, collecting warnings, duplicate ids (pure) | `src/settings/StyleSheetParser.ts` |
| Title/description translation, `sanitizeText` | `src/Utils.ts` |
| Reading stylesheets, events, commands | `src/main.ts` (`parseCSS`, `registerSettingCommands`) |
| Types and fields | `src/settings/SettingType.ts`, `src/settings/SettingHandlers.ts` |
| Validation | `src/settings/SettingsValidation.ts` |
| Storage keys, pruning, classes, applying CSS | `src/settings/SettingsManager.ts` |
| CSS generation (pure) | `src/settings/StyleGenerator.ts` |
| Heading tree | `src/settingsView/components/HeadingSettingComponent.ts` (`buildSettingComponentTree`) |

### Decisions

The open questions of the baseline were resolved as follows:

- **Error labels (AC-7, AC-26):** labeling every error with the first `name:` of the stylesheet was a bug. Errors and warnings now name the block they come from.
- **Duplicate section ids (AC-27, AC-28):** the second block used to replace the first in the stored configuration, so the first block's saved values were pruned and its controls had no effect. Blocks that share an id are now merged, which also lets authors split a long section into several blocks. Only a real conflict, the same setting id twice under one section id, warns.
- **Gradient lookup (AC-24):** matching gradient endpoints across sections only worked by accident (the gradient's own section also needed a saved color) and let unrelated sections feed each other. Lookup is now limited to the gradient's own section id, as the author guide said. Cross-section gradients stop working; the theme fallback for `to` is unchanged.
- **Heading level 0:** reserved for the implicit section heading. Validation keeps turning a `level: 0` in a block into 1; the TypeScript type for user headings now excludes 0.

## Test plan

| Criterion | Test |
| --- | --- |
| AC-1 to AC-7, AC-26, AC-28 | `src/settings/StyleSheetParser.test.ts` |
| AC-8 | **Gap:** event wiring in `main.ts` has no unit tests |
| AC-9 | **Gap** |
| AC-10 | `src/settings/SettingsValidation.test.ts` (one `describe` per type) |
| AC-11 to AC-13 | **Gap** |
| AC-14, AC-17 | `src/settings/SettingsManager.test.ts` – "section export selection"; `tests/browser/settings.spec.mjs` – "reset removes the override…", "themed alpha colors persist and reset independently" |
| AC-15 | **Gap** |
| AC-16 | `tests/browser/settings.spec.mjs` – "changing snippet configuration removes and restores its settings" |
| AC-18, AC-19, AC-21 | `src/settings/StyleGenerator.test.ts` – compatibility fixtures ("unsaved defaults remain in the snippet", "numbers text selects and ignored settings", "independent light and dark colors") |
| AC-20 | **Gap** |
| AC-22 | **Gap** |
| AC-23 | `src/settings/StyleGenerator.test.ts` – "invalid saved colors produce diagnostics without CSS"; `src/settings/SettingsManager.test.ts` – "reports invalid values through the host…"; `tests/browser/settings.spec.mjs` – "invalid input … cannot corrupt a saved color" |
| AC-24, AC-25 | `src/settings/StyleGenerator.test.ts` – gradient fixtures and "gradient endpoints are limited to their own section" |
| AC-27 | `src/settings/SettingsManager.test.ts` – "blocks sharing a section id" |

## Known discrepancies

The author guide differs from the implemented behavior here. Until each is resolved, this spec describes the code.

1. The author guide says there are 7 setting types; there are 11.
2. The author guide says `class-select` sets a CSS variable named after `id`. It actually adds the selected option value as a class on `body` and sets no variable.
3. The author guide says `class-select` must have a `default` when `allowEmpty` is `false`. This is not enforced: without a default and a saved value, no class is added.
4. The author guide says `variable-color` requires a `default` in hex or rgb. `default` is optional, and `hsl…` defaults are also accepted.
5. The author guide's "This will output the variable" examples show default values. Variables are emitted only for saved values (AC-19).

## Open questions

None.
