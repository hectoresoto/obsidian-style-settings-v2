import { describe, expect, it } from 'vitest';

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

const { findDuplicateSettingIds, parseStyleSheetText } = await import(
	'./StyleSheetParser'
);

function block(yaml: string, opener = '/* @settings') {
	return `${opener}\n${yaml}\n*/`;
}

const ocean = `name: Ocean
id: ocean
settings:
    -
        id: accent
        title: Accent
        type: variable-color
        format: hex
        default: '#336699'`;

describe('discovery and parsing', () => {
	it('AC-1: parses /* and /*! @settings comments followed by a line break', () => {
		const text = [
			block(ocean),
			block(ocean.replace('id: ocean', 'id: bang'), '/*!   @settings'),
			'/* @settings name: Inline\nid: inline\nsettings: [] */',
			'body { color: red; }',
		].join('\n');
		const { sections, errors } = parseStyleSheetText(text);
		expect(sections.map((s) => s.id)).toEqual(['ocean', 'bang']);
		expect(errors).toEqual([]);
	});

	it('AC-2: each comment produces its own section', () => {
		const text = block(ocean) + block(ocean.replace(/Ocean|ocean/g, 'Sky'));
		expect(parseStyleSheetText(text).sections.map((s) => s.name)).toEqual([
			'Ocean',
			'Sky',
		]);
	});

	it('AC-3: tabs are replaced with the detected indentation', () => {
		const tabbed = ocean.replace(/ {4}/g, '\t');
		const { sections, errors } = parseStyleSheetText(block(tabbed));
		expect(errors).toEqual([]);
		expect(sections[0].settings[0].id).toBe('accent');
	});

	it('AC-4: merge keys are applied', () => {
		const yaml = `name: Merge
id: merge
settings:
    - &base
        id: one
        title: One
        type: class-toggle
    -
        <<: *base
        id: two`;
		const { sections } = parseStyleSheetText(block(yaml));
		expect(sections[0].settings.map((s) => [s.id, s.type])).toEqual([
			['one', 'class-toggle'],
			['two', 'class-toggle'],
		]);
	});

	it('AC-5: blocks without name, id or settings are ignored', () => {
		const text = [
			block(
				'name: No id\nsettings:\n    - {id: a, title: A, type: class-toggle}'
			),
			block('name: No settings\nid: empty\nsettings: []'),
			block(
				'id: noname\nsettings:\n    - {id: a, title: A, type: class-toggle}'
			),
		].join('\n');
		expect(parseStyleSheetText(text).sections).toEqual([]);
	});

	it('AC-6: null entries are dropped', () => {
		const yaml = `name: Nulls
id: nulls
settings:
    -
    - {id: a, title: A, type: class-toggle}
    -`;
		const { sections } = parseStyleSheetText(block(yaml));
		expect(sections[0].settings.map((s) => s.id)).toEqual(['a']);
	});
});

describe('error labels', () => {
	it("AC-7: a YAML error is labeled with its own block's name and other blocks still load", () => {
		const broken = 'name: Broken\nid: broken\nsettings:\n    - id: [unclosed';
		const text = block(ocean) + '\n' + block(broken);
		const { sections, errors } = parseStyleSheetText(text);
		expect(sections.map((s) => s.id)).toEqual(['ocean']);
		expect(errors).toHaveLength(1);
		expect(errors[0].name).toBe('Broken');
	});

	it('AC-7: a YAML error in a block without name: uses the first name: of the stylesheet', () => {
		const text = block(ocean) + '\n' + block('id: [unclosed');
		const { errors } = parseStyleSheetText(text);
		expect(errors).toHaveLength(1);
		expect(errors[0].name).toBe('Ocean');
	});

	it("AC-26: validation warnings are labeled with their own block's name", () => {
		const sky = `name: Sky
id: sky
settings:
    - {id: level, title: Level, type: heading, level: 9}`;
		const text = block(ocean) + '\n' + block(sky);
		const { errors } = parseStyleSheetText(text);
		expect(errors).toEqual([
			{
				name: 'Sky',
				error: expect.stringContaining('[INVALID_HEADING_LEVEL]'),
			},
		]);
	});
});

describe('duplicate setting ids', () => {
	function sections(...yamls: string[]) {
		return yamls.flatMap((yaml) => parseStyleSheetText(block(yaml)).sections);
	}

	const first = `name: First
id: shared
settings:
    - {id: group, title: Group, type: heading, level: 1}
    - {id: note, title: Note, type: info-text}
    - {id: accent, title: Accent, type: variable-color, format: hex}
    - {id: wide, title: Wide, type: class-toggle}`;

	it('AC-28: warns once, labeled with the later block, when blocks sharing a section id repeat a setting id', () => {
		const second = `name: Second
id: shared
settings:
    - {id: group, title: Group, type: heading, level: 1}
    - {id: note, title: Note, type: info-text}
    - {id: accent, title: Accent again, type: variable-color, format: hex}
    - {id: other, title: Other, type: class-toggle}`;
		expect(findDuplicateSettingIds(sections(first, second))).toEqual([
			{
				name: 'Second',
				error: expect.stringMatching(
					/^\[DUPLICATE_SETTING_ID\] .*accent.*shared/
				),
			},
		]);
	});

	it('AC-28: warns about a setting id repeated inside one block', () => {
		const repeated = `name: Repeated
id: repeated
settings:
    - {id: wide, title: Wide, type: class-toggle}
    - {id: wide, title: Wide again, type: class-toggle}`;
		expect(findDuplicateSettingIds(sections(repeated))).toEqual([
			{
				name: 'Repeated',
				error: expect.stringContaining('[DUPLICATE_SETTING_ID]'),
			},
		]);
	});

	it('AC-28: the same setting id under different section ids is not a duplicate', () => {
		const elsewhere = first.replace('id: shared', 'id: elsewhere');
		expect(findDuplicateSettingIds(sections(first, elsewhere))).toEqual([]);
	});
});
