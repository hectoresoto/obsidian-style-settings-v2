import { describe, expect, it, vi } from 'vitest';
import type { Meta } from './settings/SettingHandlers';

const localStorageMock: Storage = {
	length: 0,
	clear: () => undefined,
	getItem: () => null,
	key: () => null,
	removeItem: () => undefined,
	setItem: () => undefined,
};

Object.defineProperty(globalThis, 'window', {
	value: {
		localStorage: localStorageMock,
	},
	writable: true,
});

const { isValidDefaultColor, isValidSavedColor, sanitizeText } = await import(
	'./Utils'
);

// The language is read once when `lang/helpers` loads, so each language needs a fresh module graph.
async function importUtilsWithLanguage(language: string | null) {
	vi.resetModules();
	const getItem = vi
		.spyOn(localStorageMock, 'getItem')
		.mockImplementation((key) => (key === 'language' ? language : null));
	try {
		return await import('./Utils');
	} finally {
		getItem.mockRestore();
	}
}

describe('isValidDefaultColor', () => {
	it('accepts valid color prefixes', () => {
		expect(isValidDefaultColor('#ff00ff')).toBe(true);
		expect(isValidDefaultColor('rgb(0, 0, 0)')).toBe(true);
		expect(isValidDefaultColor('hsl(0, 100%, 50%)')).toBe(true);
	});

	it('rejects non-color strings', () => {
		expect(isValidDefaultColor('banana')).toBe(false);
	});
});

describe('isValidSavedColor', () => {
	it('accepts valid colors', () => {
		expect(isValidSavedColor('#00ff00')).toBe(true);
		expect(isValidSavedColor('rgb(10, 20, 30)')).toBe(true);
	});

	it('rejects NaN-containing strings', () => {
		expect(isValidSavedColor('#NANNANNAN')).toBe(false);
		expect(isValidSavedColor('rgb(NaN, NaN, NaN)')).toBe(false);
	});

	it('rejects non-color strings', () => {
		expect(isValidSavedColor('not-a-color')).toBe(false);
	});
});

describe('translated titles and descriptions (AC-9)', () => {
	const setting = {
		id: 'accent',
		type: 'class-toggle',
		title: 'Accent',
		description: 'Use the accent color',
		'title.de': 'Akzent',
		'description.de': 'Akzentfarbe verwenden',
		'title.pt-BR': 'Destaque',
		'description.zh-TW': '使用強調色',
	} as Meta;

	it('uses the translation for the current language', async () => {
		const { getTitle, getDescription } = await importUtilsWithLanguage('de');
		expect(getTitle(setting)).toBe('Akzent');
		expect(getDescription(setting)).toBe('Akzentfarbe verwenden');
	});

	it('supports region codes', async () => {
		const ptBr = await importUtilsWithLanguage('pt-BR');
		expect(ptBr.getTitle(setting)).toBe('Destaque');
		expect(ptBr.getDescription(setting)).toBe('Use the accent color');

		const zhTw = await importUtilsWithLanguage('zh-TW');
		expect(zhTw.getTitle(setting)).toBe('Accent');
		expect(zhTw.getDescription(setting)).toBe('使用強調色');
	});

	it('falls back to title and description without a translation', async () => {
		const { getTitle, getDescription } = await importUtilsWithLanguage('fr');
		expect(getTitle(setting)).toBe('Accent');
		expect(getDescription(setting)).toBe('Use the accent color');
	});

	it('falls back to title and description when no language is set', async () => {
		const { getTitle, getDescription } = await importUtilsWithLanguage(null);
		expect(getTitle(setting)).toBe('Accent');
		expect(getDescription(setting)).toBe('Use the accent color');
	});

	it('leaves the description empty when neither exists', async () => {
		const { getDescription } = await importUtilsWithLanguage('de');
		expect(
			getDescription({ id: 'plain', type: 'class-toggle', title: 'Plain' })
		).toBeUndefined();
	});
});

describe('sanitizeText (AC-22)', () => {
	it('removes semicolons and angle brackets', () => {
		expect(sanitizeText('red; } body { color: blue')).toBe(
			'red } body { color: blue'
		);
		expect(sanitizeText('</style><script>')).toBe('/stylescript');
		expect(sanitizeText('a;b<c>d;;')).toBe('abcd');
	});

	it('keeps other text unchanged', () => {
		expect(sanitizeText("'Inter', sans-serif")).toBe("'Inter', sans-serif");
	});

	it('stores an empty string as two double quotes', () => {
		expect(sanitizeText('')).toBe('""');
	});
});
