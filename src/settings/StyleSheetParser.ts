import type { CSSSetting, ParsedCSSSettings } from './SettingHandlers';
import type { ErrorList } from '../Utils';
import { SettingType } from './SettingType';
import {
	validateAndNormalizeSetting,
	ValidationWarning,
} from './SettingsValidation';
import detectIndent from 'detect-indent';
import { CORE_SCHEMA, load, mergeTag } from 'js-yaml';

export const settingRegExp = /\/\*!?\s*@settings[\r\n]+?([\s\S]+?)\*\//g;
export const nameRegExp = /^name:\s*(.+)$/m;

// js-yaml 5 dropped merge keys (`<<`) from its default schema; themes may rely on them.
const settingsSchema = CORE_SCHEMA.withTags(mergeTag);

export interface ParsedStyleSheet {
	sections: ParsedCSSSettings[];
	errors: ErrorList;
}

/**
 * Parses every `@settings` block in the text of one stylesheet.
 * Blocks that fail to load or lack `name`, `id` or `settings` are skipped.
 */
export function parseStyleSheetText(text: string): ParsedStyleSheet {
	const sections: ParsedCSSSettings[] = [];
	const errors: ErrorList = [];

	const fileName = text.match(nameRegExp)?.[1];

	for (const match of text.matchAll(settingRegExp)) {
		const str = match[1].trim();
		// Label errors with the block's own name; fall back to the file's first one.
		const name = str.match(nameRegExp)?.[1] ?? fileName;
		if (!name) continue;

		try {
			const result = parseCSSSettings(str, name);

			if (result && result.parsed) {
				const { parsed, warnings } = result;
				if (
					parsed.name &&
					parsed.id &&
					parsed.settings &&
					parsed.settings.length
				) {
					sections.push(parsed);
					for (const warning of warnings) {
						errors.push({
							name: parsed.name,
							error: `[${warning.code}] ${warning.message}`,
						});
					}
				}
			}
		} catch (e) {
			errors.push({ name, error: `${e}` });
		}
	}

	return { sections, errors };
}

/**
 * Warns about setting ids defined more than once under the same section id.
 */
export function findDuplicateSettingIds(
	sections: ParsedCSSSettings[]
): ErrorList {
	const errors: ErrorList = [];
	const seen = new Set<string>();

	for (const section of sections) {
		for (const setting of section.settings) {
			// Headings and info text store no value, so a repeated id is harmless.
			if (
				setting.type === SettingType.HEADING ||
				setting.type === SettingType.INFO_TEXT
			) {
				continue;
			}

			const key = `${section.id}@@${setting.id}`;
			if (seen.has(key)) {
				errors.push({
					name: section.name,
					error: `[DUPLICATE_SETTING_ID] Setting "${setting.id}" is defined more than once in section "${section.id}"; the last definition is used.`,
				});
			}
			seen.add(key);
		}
	}

	return errors;
}

/**
 * Parse css settings from a string.
 *
 * @param str the stringified settings to parse
 * @param name the name used to label YAML errors
 */
function parseCSSSettings(
	str: string,
	name: string
): { parsed: ParsedCSSSettings; warnings: ValidationWarning[] } | undefined {
	const indent = detectIndent(str);

	const settings: ParsedCSSSettings = load(
		str.replace(/\t/g, indent.type === 'space' ? indent.indent : '    '),
		{
			filename: name,
			schema: settingsSchema,
		}
	) as ParsedCSSSettings;

	if (!settings.settings) return undefined;

	settings.settings = settings.settings.filter((setting) => setting);

	const validatedSettings: CSSSetting[] = [];
	const warnings: ValidationWarning[] = [];

	for (const setting of settings.settings) {
		const result = validateAndNormalizeSetting(setting);
		validatedSettings.push(result.setting);
		warnings.push(...result.warnings);
	}

	settings.settings = validatedSettings;
	return { parsed: settings, warnings };
}
