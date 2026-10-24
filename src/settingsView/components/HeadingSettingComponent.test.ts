import { describe, expect, it, vi } from 'vitest';
import type {
	CSSSetting,
	SectionHeading,
} from '../../settings/SettingHandlers';
import type { CSSSettingsManager } from '../../settings/SettingsManager';

Object.defineProperty(globalThis, 'window', {
	value: { localStorage: { getItem: () => null } },
	writable: true,
});

// Building the tree only constructs components; nothing is rendered.
vi.mock('obsidian', () => ({ Component: class {} }));
vi.mock('@simonwep/pickr', () => ({ default: class {} }));

vi.mock('../../settings/SettingsManager', () => ({
	CSSSettingsManager: class {},
}));

const { buildSettingComponentTree } = await import('./HeadingSettingComponent');

type Tree = { id: string; children?: Tree[] };

function toTree(component: {
	setting: { id: string; type: string };
	children?: unknown[];
}): Tree {
	if (component.setting.type !== 'heading') return { id: component.setting.id };
	return {
		id: component.setting.id,
		children: (component.children ?? []).map((child) =>
			toTree(child as Parameters<typeof toTree>[0])
		),
	};
}

function heading(id: string, level: number): CSSSetting {
	return { id, type: 'heading', title: id, level } as CSSSetting;
}

function toggle(id: string): CSSSetting {
	return { id, type: 'class-toggle', title: id } as CSSSetting;
}

function build(settings: CSSSetting[]): Tree {
	const sectionHeading: SectionHeading = {
		id: 'section',
		type: 'heading',
		title: 'Section',
		level: 0,
	};
	return toTree(
		buildSettingComponentTree({
			containerEl: {} as HTMLElement,
			isView: false,
			sectionId: 'section',
			sectionName: 'Section',
			sectionHeading,
			settings,
			settingsManager: {} as CSSSettingsManager,
		})
	);
}

describe('buildSettingComponentTree (AC-11)', () => {
	it('places settings before the first heading under the section heading', () => {
		expect(build([toggle('a'), heading('h1', 1), toggle('b')])).toEqual({
			id: 'section',
			children: [{ id: 'a' }, { id: 'h1', children: [{ id: 'b' }] }],
		});
	});

	it('assigns each setting to the closest preceding heading', () => {
		expect(
			build([
				heading('h1', 1),
				toggle('a'),
				heading('h2', 2),
				toggle('b'),
				toggle('c'),
			])
		).toEqual({
			id: 'section',
			children: [
				{
					id: 'h1',
					children: [
						{ id: 'a' },
						{ id: 'h2', children: [{ id: 'b' }, { id: 'c' }] },
					],
				},
			],
		});
	});

	it('makes headings of the same level siblings', () => {
		expect(
			build([
				heading('a', 1),
				heading('a1', 2),
				heading('a2', 2),
				heading('b', 1),
			])
		).toEqual({
			id: 'section',
			children: [
				{
					id: 'a',
					children: [
						{ id: 'a1', children: [] },
						{ id: 'a2', children: [] },
					],
				},
				{ id: 'b', children: [] },
			],
		});
	});

	it('returns to the closest preceding heading with a lower level', () => {
		expect(
			build([
				heading('a', 1),
				heading('a1', 2),
				heading('a1x', 3),
				toggle('deep'),
				heading('a2', 2),
				toggle('mid'),
				heading('b', 1),
				toggle('top'),
			])
		).toEqual({
			id: 'section',
			children: [
				{
					id: 'a',
					children: [
						{
							id: 'a1',
							children: [{ id: 'a1x', children: [{ id: 'deep' }] }],
						},
						{ id: 'a2', children: [{ id: 'mid' }] },
					],
				},
				{ id: 'b', children: [{ id: 'top' }] },
			],
		});
	});

	it('places a first heading deeper than level 1 under the section heading', () => {
		expect(build([heading('h2', 2), heading('h1', 1)])).toEqual({
			id: 'section',
			children: [
				{ id: 'h2', children: [] },
				{ id: 'h1', children: [] },
			],
		});
	});
});
