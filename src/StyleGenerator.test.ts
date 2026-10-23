import type { CSSSetting, ColorGradient } from './SettingHandlers';
import type { CSSSettings, MappedSettings } from './SettingsTypes';
import { generateStyles } from './StyleGenerator';
import { describe, expect, it, vi } from 'vitest';

interface Fixture {
	name: string;
	settings: CSSSettings;
	config: MappedSettings;
	gradients?: Record<string, ColorGradient[]>;
	themeVariables?: Record<
		string,
		{ current?: string; light?: string; dark?: string }
	>;
}

function config(...settings: CSSSetting[]): MappedSettings {
	return {
		ocean: Object.fromEntries(settings.map((setting) => [setting.id, setting])),
	};
}

const start: CSSSetting = {
	id: 'start',
	title: 'Start',
	type: 'variable-color',
	format: 'hex',
	default: '#000000',
};
const end: CSSSetting = {
	id: 'end',
	title: 'End',
	type: 'variable-color',
	format: 'hex',
	default: '#ffffff',
};
const gradient: ColorGradient = {
	id: 'shade',
	title: 'Shade',
	type: 'color-gradient',
	from: 'start',
	to: 'end',
	format: 'hex',
	step: 50,
	pad: 3,
};
const themedStart: CSSSetting = {
	id: 'start',
	title: 'Start',
	type: 'variable-themed-color',
	format: 'hex',
	'default-light': '#000000',
	'default-dark': '#ffffff',
	'alt-format': [],
};

const fixtures: Fixture[] = [
	{ name: 'empty settings', settings: {}, config: {} },
	{
		name: 'unsaved defaults remain in the snippet',
		settings: {},
		config: config(start, end),
	},
	{
		name: 'numbers text selects and ignored settings',
		settings: {
			'ocean@@spacing': 0,
			'ocean@@size': 1.5,
			'ocean@@font': 'Inter',
			'ocean@@empty': '""',
			'ocean@@layout': 'wide',
			'ocean@@feature': false,
			'ocean@@removed': 'ignored',
			'missing@@spacing': 42,
		},
		config: config(
			{
				id: 'spacing',
				title: 'Spacing',
				type: 'variable-number',
				default: 4,
				format: 'px',
			},
			{
				id: 'size',
				title: 'Size',
				type: 'variable-number-slider',
				default: 1,
				min: 0,
				max: 5,
				step: 0.5,
				format: 'em',
			},
			{
				id: 'font',
				title: 'Font',
				type: 'variable-text',
				default: 'sans-serif',
				quotes: true,
			},
			{
				id: 'empty',
				title: 'Empty',
				type: 'variable-text',
				default: '',
				quotes: true,
			},
			{
				id: 'layout',
				title: 'Layout',
				type: 'variable-select',
				default: 'wide',
				options: ['wide', 'narrow'],
			},
			{ id: 'feature', title: 'Feature', type: 'class-toggle', default: true }
		),
	},
	{
		name: 'alpha color and alternative formats',
		settings: { 'ocean@@accent': '#33669980' },
		config: config({
			id: 'accent',
			title: 'Accent',
			type: 'variable-color',
			format: 'hex',
			opacity: true,
			'alt-format': [
				{ id: 'accent-rgb', format: 'rgb' },
				{ id: 'accent-hsl', format: 'hsl' },
				{ id: 'accent-values', format: 'rgb-values' },
				{ id: 'accent-hsl-values', format: 'hsl-values' },
				{ id: 'accent-split', format: 'rgb-split' },
				{ id: 'accent-hsl-split', format: 'hsl-split' },
				{ id: 'accent-decimal', format: 'hsl-split-decimal' },
			],
		}),
	},
	{
		name: 'independent light and dark colors',
		settings: {
			'ocean@@start@@light': '#33669980',
			'ocean@@start@@dark': '#808080',
		},
		config: config({ ...themedStart, format: 'hsl-split', opacity: true }),
	},
	{
		name: 'gradient endpoints from saved settings',
		settings: { 'ocean@@start': '#000000', 'ocean@@end': '#ffffff' },
		config: config(start, end),
		gradients: { ocean: [gradient] },
	},
	{
		name: 'gradient falls back to current theme variables',
		settings: { 'ocean@@start': '#000000' },
		config: config(start),
		gradients: { ocean: [gradient] },
		themeVariables: { end: { current: '  #ffffff  ' } },
	},
	{
		name: 'themed gradients use separate fallback endpoints',
		settings: {
			'ocean@@start@@light': '#000000',
			'ocean@@start@@dark': '#ffffff',
		},
		config: config(themedStart),
		gradients: { ocean: [{ ...gradient, format: 'rgb' }] },
		themeVariables: {
			end: { current: '#ff0000', light: ' #ffffff ', dark: ' #000000 ' },
		},
	},
	{
		name: 'missing gradient endpoint is omitted',
		settings: { 'ocean@@start': '#000000' },
		config: config(start),
		gradients: { ocean: [gradient] },
	},
	{
		name: 'invalid saved colors produce diagnostics without CSS',
		settings: {
			'ocean@@start': 'banana',
			'ocean@@end': '#ZZZZZZ',
			'ocean@@tint@@light': 'rgb(NaN, 0, 0)',
		},
		config: config(start, end, { ...themedStart, id: 'tint' }),
	},
];

function generate(input: Fixture) {
	const { cssText, warnings } = generateStyles(input);
	return { cssText, warnings };
}

// Snapshots were captured from the original manager before extracting this engine.
describe('style generation compatibility', () => {
	for (const fixture of fixtures) {
		it(fixture.name, () => {
			const before = JSON.stringify(fixture);
			expect(generate(fixture)).toMatchSnapshot();
			expect(JSON.stringify(fixture)).toBe(before);
		});
	}

	it('runs without browser globals or mocked Obsidian APIs', () => {
		expect(typeof window).toBe('undefined');
		expect(typeof document).toBe('undefined');
		expect(generateStyles(fixtures[0]).variables).toEqual({
			base: [],
			light: [],
			dark: [],
		});
	});

	it('returns diagnostics instead of logging inside the generator', () => {
		const warn = vi.spyOn(console, 'warn');
		try {
			const result = generateStyles(fixtures[9]);
			expect(result.warnings).toHaveLength(4);
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});

	it('returns independent results without retaining state between calls', () => {
		const first = generateStyles(fixtures[3]);
		const second = generateStyles(fixtures[3]);
		first.variables.base.length = 0;
		first.warnings.push('changed by caller');
		expect(second).toEqual(generateStyles(fixtures[3]));
	});
});
