import type {
	AltFormatList,
	ColorFormat,
	ColorGradient,
	CSSSetting,
	VariableColor,
	VariableNumber,
	VariableNumberSlider,
	VariableSelect,
	VariableText,
	VariableThemedColor,
} from './SettingHandlers';
import type {
	CSSSettings,
	MappedSettings,
	SettingValue,
} from './SettingsTypes';
import { isValidSavedColor } from '../color/ColorUtils';
import { SettingType } from './SettingType';
import chroma from 'chroma-js';

export type VariableKV = Array<{ key: string; value: string }>;
export interface ThemeVariable {
	current?: string;
	light?: string;
	dark?: string;
}
export type ThemeVariables = Record<string, ThemeVariable>;
export interface StyleGenerationInput {
	settings: CSSSettings;
	config: MappedSettings;
	gradients?: Record<string, ColorGradient[]>;
	themeVariables?: ThemeVariables;
}
export interface GeneratedStyles {
	variables: { base: VariableKV; light: VariableKV; dark: VariableKV };
	cssText: string;
	warnings: string[];
}

/** Generate styles from values only, without reading or modifying the host. */
export function generateStyles({
	settings,
	config,
	gradients = {},
	themeVariables = {},
}: StyleGenerationInput): GeneratedStyles {
	const warnings: string[] = [];
	const [vars, themedLight, themedDark] = getCSSVariables(
		settings,
		config,
		gradients,
		themeVariables,
		warnings
	);
	const cssText = `
			body.css-settings-manager {
				${vars.reduce((combined, current) => {
					return combined + `--${current.key}: ${current.value}; `;
				}, '')}
			}

			body.theme-light.css-settings-manager {
				${themedLight.reduce((combined, current) => {
					return combined + `--${current.key}: ${current.value}; `;
				}, '')}
			}

			body.theme-dark.css-settings-manager {
				${themedDark.reduce((combined, current) => {
					return combined + `--${current.key}: ${current.value}; `;
				}, '')}
			}
			`
		.trim()
		.replace(/[\r\n\s]+/g, ' ');
	return {
		variables: { base: vars, light: themedLight, dark: themedDark },
		cssText,
		warnings,
	};
}

export function safeRound(n: number): number {
	return isNaN(n) ? 0 : Math.round(n);
}

export function safeNum(n: number): number {
	return isNaN(n) ? 0 : n;
}

export function generateColorVariables(
	key: string,
	format: ColorFormat,
	colorStr: string,
	opacity: boolean | undefined,
	altFormats: AltFormatList = [],
	warnings: string[] = []
): VariableKV {
	let parsedColor: ReturnType<typeof chroma>;
	try {
		parsedColor = chroma(colorStr);
	} catch {
		warnings.push(
			`Style Settings: could not parse color "${colorStr}" for variable --${key}; skipping.`
		);
		return [];
	}
	const alts = altFormats.reduce<VariableKV>((a, alt) => {
		a.push(
			...generateColorVariables(
				alt.id,
				alt.format,
				colorStr,
				opacity,
				[],
				warnings
			)
		);
		return a;
	}, []);

	switch (format) {
		case 'hex':
			return [{ key, value: colorStr }, ...alts];
		case 'hsl':
			return [
				{
					key,
					value: parsedColor.css('hsl'),
				},
				...alts,
			];
		case 'hsl-values': {
			const hsl = parsedColor.hsl();
			const alpha = opacity ? `,${safeNum(parsedColor.alpha())}` : '';
			const h = safeNum(hsl[0]);

			return [
				{
					key,
					value: `${h},${safeNum(hsl[1]) * 100}%,${
						safeNum(hsl[2]) * 100
					}%${alpha}`,
				},
				...alts,
			];
		}
		case 'hsl-split': {
			const hsl = parsedColor.hsl();
			const h = safeNum(hsl[0]);
			const out = [
				{
					key: `${key}-h`,
					value: h.toString(),
				},
				{
					key: `${key}-s`,
					value: (safeNum(hsl[1]) * 100).toString() + '%',
				},
				{
					key: `${key}-l`,
					value: (safeNum(hsl[2]) * 100).toString() + '%',
				},
				...alts,
			];

			if (opacity)
				out.push({
					key: `${key}-a`,
					value: safeNum(parsedColor.alpha()).toString(),
				});

			return out;
		}
		case 'hsl-split-decimal': {
			const hsl = parsedColor.hsl();
			const h = safeNum(hsl[0]);
			const out = [
				{
					key: `${key}-h`,
					value: h.toString(),
				},
				{
					key: `${key}-s`,
					value: safeNum(hsl[1]).toString(),
				},
				{
					key: `${key}-l`,
					value: safeNum(hsl[2]).toString(),
				},
				...alts,
			];

			if (opacity)
				out.push({
					key: `${key}-a`,
					value: safeNum(parsedColor.alpha()).toString(),
				});

			return out;
		}
		case 'rgb':
			return [
				{
					key,
					value: parsedColor.css(),
				},
				...alts,
			];
		case 'rgb-values': {
			const rgb = parsedColor.rgb();
			const alpha = opacity ? `, ${safeNum(parsedColor.alpha())}` : '';
			return [
				{
					key,
					value: `${safeRound(rgb[0])}, ${safeRound(rgb[1])}, ${safeRound(
						rgb[2]
					)}${alpha}`,
				},
				...alts,
			];
		}
		case 'rgb-split': {
			const rgb = parsedColor.rgb();
			const out = [
				{
					key: `${key}-r`,
					value: safeRound(rgb[0]).toString(),
				},
				{
					key: `${key}-g`,
					value: safeRound(rgb[1]).toString(),
				},
				{
					key: `${key}-b`,
					value: safeRound(rgb[2]).toString(),
				},
				...alts,
			];

			if (opacity)
				out.push({
					key: `${key}-a`,
					value: safeNum(parsedColor.alpha()).toString(),
				});

			return out;
		}
	}
}

function pushColors(
	arr: VariableKV,
	id: string,
	from: string,
	to: string,
	format: 'hsl' | 'rgb' | 'hex',
	step: number,
	pad: number,
	warnings: string[]
) {
	const scale = chroma.scale([from.trim(), to.trim()]).domain([0, 100]);
	for (let i = 0; i <= 100; i++) {
		if (i % step === 0) {
			const c = scale(i);
			arr.push(
				...generateColorVariables(
					`${id}-${i.toString().padStart(pad, '0')}`,
					format,
					c.css(),
					c.alpha() !== 1,
					[],
					warnings
				)
			);
		}
	}
}

function getCSSVariables(
	settings: CSSSettings,
	config: MappedSettings,
	gradients: Record<string, ColorGradient[]>,
	themeVariables: ThemeVariables,
	warnings: string[]
): [VariableKV, VariableKV, VariableKV] {
	const vars: VariableKV = [];
	const themedLight: VariableKV = [];
	const themedDark: VariableKV = [];

	// Keyed by `<sectionId>@@<settingId>`: gradients only use colors of their own section.
	const gradientCandidates: Record<string, string> = {};
	const gradientCandidatesLight: Record<string, string> = {};
	const gradientCandidatesDark: Record<string, string> = {};

	const seenGradientSections: Set<string> = new Set();

	for (const key in settings) {
		const [sectionId, settingId, modifier] = key.split('@@');
		const section = config[sectionId];

		if (!section) continue;

		const setting: CSSSetting = config[sectionId][settingId];

		if (!setting) continue;

		const value: SettingValue = settings[key];

		switch (setting.type) {
			case SettingType.VARIABLE_NUMBER:
			case SettingType.VARIABLE_NUMBER_SLIDER: {
				const format = (setting as VariableNumber | VariableNumberSlider)
					.format;
				const val =
					value !== undefined
						? value
						: (setting as VariableNumber | VariableNumberSlider).default;
				vars.push({
					key: setting.id,
					value: `${val}${format || ''}`,
				});
				continue;
			}
			case SettingType.VARIABLE_TEXT:
			case SettingType.VARIABLE_SELECT: {
				const format_text = setting as VariableText | VariableSelect;
				let text =
					value !== undefined
						? value.toString()
						: format_text.default.toString();
				if (format_text.quotes) {
					if (text !== `""`) {
						text = `'${text}'`;
					} else {
						text = ``;
					}
				}
				vars.push({
					key: setting.id,
					value: text,
				});
				continue;
			}
			case SettingType.VARIABLE_COLOR: {
				if (!seenGradientSections.has(sectionId))
					seenGradientSections.add(sectionId);

				const colorSetting = setting as VariableColor;
				const rawColor =
					value !== undefined ? value.toString() : colorSetting.default;
				const color =
					rawColor && isValidSavedColor(rawColor) ? rawColor : undefined;

				if (color) {
					vars.push(
						...generateColorVariables(
							setting.id,
							colorSetting.format,
							color,
							colorSetting.opacity,
							colorSetting['alt-format'],
							warnings
						)
					);

					generateColorVariables(
						setting.id,
						'rgb',
						color,
						colorSetting.opacity,
						[],
						warnings
					).forEach((kv) => {
						gradientCandidates[`${sectionId}@@${kv.key}`] = kv.value;
					});
				} else if (rawColor) {
					warnings.push(
						`Style Settings: invalid saved color "${rawColor}" for --${setting.id}; skipping.`
					);
				}

				continue;
			}
			case SettingType.VARIABLE_THEMED_COLOR: {
				if (!seenGradientSections.has(sectionId))
					seenGradientSections.add(sectionId);

				const colorSetting = setting as VariableThemedColor;
				const colorKey =
					modifier === 'light' ? 'default-light' : 'default-dark';
				const rawColor =
					value !== undefined ? value.toString() : colorSetting[colorKey];
				const color =
					rawColor && isValidSavedColor(rawColor) ? rawColor : undefined;

				if (color) {
					(modifier === 'light' ? themedLight : themedDark).push(
						...generateColorVariables(
							setting.id,
							colorSetting.format,
							color,
							colorSetting.opacity,
							colorSetting['alt-format'],
							warnings
						)
					);

					generateColorVariables(
						setting.id,
						'rgb',
						color,
						colorSetting.opacity,
						[],
						warnings
					).forEach((kv) => {
						if (modifier === 'light') {
							gradientCandidatesLight[`${sectionId}@@${kv.key}`] = kv.value;
						} else {
							gradientCandidatesDark[`${sectionId}@@${kv.key}`] = kv.value;
						}
					});
				} else if (rawColor) {
					warnings.push(
						`Style Settings: invalid saved color "${rawColor}" for --${setting.id}; skipping.`
					);
				}
				continue;
			}
		}
	}

	seenGradientSections.forEach((sectionId) => {
		const g = gradients[sectionId];
		if (!g) return;

		g.forEach((def) => {
			const { from, to, format, step, id, pad = 0 } = def;
			const fromKey = `${sectionId}@@${from}`;
			const toKey = `${sectionId}@@${to}`;

			if (gradientCandidatesLight[fromKey]) {
				const fromColor = gradientCandidatesLight[fromKey];
				const toColor =
					gradientCandidatesLight[toKey] || themeVariables[to]?.light?.trim();

				if (toColor) {
					pushColors(
						themedLight,
						id,
						fromColor,
						toColor,
						format,
						step,
						pad,
						warnings
					);
				}
			}

			if (gradientCandidatesDark[fromKey]) {
				const fromColor = gradientCandidatesDark[fromKey];
				const toColor =
					gradientCandidatesDark[toKey] || themeVariables[to]?.dark?.trim();

				if (toColor) {
					pushColors(
						themedDark,
						id,
						fromColor,
						toColor,
						format,
						step,
						pad,
						warnings
					);
				}
			}

			if (gradientCandidates[fromKey]) {
				const fromColor = gradientCandidates[fromKey];
				const toColor =
					gradientCandidates[toKey] || themeVariables[to]?.current?.trim();

				if (toColor) {
					pushColors(vars, id, fromColor, toColor, format, step, pad, warnings);
				}
			}
		});
	});

	return [vars, themedLight, themedDark];
}
