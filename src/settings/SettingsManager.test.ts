import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CSSSetting } from './SettingHandlers';
import type { SettingValue } from './SettingsTypes';

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

const bodyClasses = new Set<string>();

Object.defineProperty(globalThis, 'document', {
	value: {
		body: {
			classList: {
				add: (name: string) => bodyClasses.add(name),
				remove: (name: string) => bodyClasses.delete(name),
			},
		},
	},
	writable: true,
});

vi.mock('../modals/ExportModal', () => ({
	ExportModal: class {},
}));

vi.mock('../modals/ImportModal', () => ({
	ImportModal: class {},
}));

vi.mock('../main', () => ({
	default: class {},
}));

const { CSSSettingsManager } = await import('./SettingsManager');

function createManager(settings: Record<string, SettingValue> = {}) {
	const manager = Object.create(CSSSettingsManager.prototype) as InstanceType<
		typeof CSSSettingsManager
	>;
	manager.settings = settings;
	manager.config = {};
	manager.gradients = {};
	manager.styleTag = { innerText: '' } as HTMLStyleElement;
	manager.plugin = {
		saveData: vi.fn(),
		getCSSVar: vi.fn(() => ({})),
		app: { workspace: { trigger: vi.fn() } },
	} as unknown as typeof manager.plugin;
	return manager;
}

describe('section export selection', () => {
	it('preserves false, zero, empty text and theme overrides without leaking other sections', () => {
		const manager = Object.create(CSSSettingsManager.prototype) as InstanceType<
			typeof CSSSettingsManager
		>;
		manager.settings = {
			'ocean@@enabled': false,
			'ocean@@spacing': 0,
			'ocean@@label': '',
			'ocean@@tint@@light': '#60A5FA80',
			'ocean@@tint@@dark': '#93C5FD80',
			'other@@enabled': true,
		};
		expect(
			manager.getSettings('ocean', [
				'enabled',
				'spacing',
				'label',
				'tint',
				'missing',
			])
		).toEqual({
			'ocean@@enabled': false,
			'ocean@@spacing': 0,
			'ocean@@label': '',
			'ocean@@tint@@light': '#60A5FA80',
			'ocean@@tint@@dark': '#93C5FD80',
		});
	});
});

describe('style generator host integration', () => {
	it('reads theme endpoints once, applies generated CSS, then notifies Obsidian', () => {
		const manager = Object.create(CSSSettingsManager.prototype) as InstanceType<
			typeof CSSSettingsManager
		>;
		manager.settings = { 'ocean@@start': '#000000' };
		manager.config = {
			ocean: {
				start: {
					id: 'start',
					title: 'Start',
					type: 'variable-color',
					format: 'hex',
					default: '#000000',
				},
			},
		};
		const gradient = {
			id: 'shade',
			title: 'Shade',
			type: 'color-gradient' as const,
			from: 'start',
			to: 'end',
			format: 'rgb' as const,
			step: 50,
		};
		manager.gradients = {
			ocean: [gradient, { ...gradient, id: 'other-shade' }],
		};
		manager.styleTag = { innerText: '' } as HTMLStyleElement;
		const getCSSVar = vi.fn(() => ({ current: ' #ffffff ' }));
		const trigger = vi.fn(() => {
			expect(manager.styleTag.innerText).toContain(
				'--shade-50: rgb(128,128,128);'
			);
			expect(manager.styleTag.innerText).toContain(
				'--other-shade-100: rgb(255,255,255);'
			);
		});
		manager.plugin = {
			getCSSVar,
			app: { workspace: { trigger } },
		} as unknown as typeof manager.plugin;
		manager.setCSSVariables();
		expect(getCSSVar).toHaveBeenCalledExactlyOnceWith('end');
		expect(trigger).toHaveBeenCalledExactlyOnceWith('css-change', {
			source: 'style-settings',
		});
	});

	it('reports invalid values through the host without applying a corrupt variable', () => {
		const manager = Object.create(CSSSettingsManager.prototype) as InstanceType<
			typeof CSSSettingsManager
		>;
		manager.settings = { 'ocean@@accent': '#NaN' };
		manager.config = {
			ocean: {
				accent: {
					id: 'accent',
					title: 'Accent',
					type: 'variable-color',
					format: 'hex',
					default: '#000000',
				},
			},
		};
		manager.gradients = {};
		manager.styleTag = { innerText: '' } as HTMLStyleElement;
		manager.plugin = {
			app: { workspace: { trigger: vi.fn() } },
		} as unknown as typeof manager.plugin;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			manager.setCSSVariables();
			expect(warn).toHaveBeenCalledExactlyOnceWith(
				'Style Settings: invalid saved color "#NaN" for --accent; skipping.'
			);
			expect(manager.styleTag.innerText).not.toContain('--accent:');
		} finally {
			warn.mockRestore();
		}
	});
});

describe('blocks sharing a section id', () => {
	it('AC-27: merges their settings so saved values are kept, not pruned, and applied', () => {
		const manager = Object.create(CSSSettingsManager.prototype) as InstanceType<
			typeof CSSSettingsManager
		>;
		manager.settings = {
			'shared@@first': '#000000',
			'shared@@second': '#ffffff',
		};
		manager.styleTag = { innerText: '' } as HTMLStyleElement;
		const saveData = vi.fn();
		manager.plugin = {
			saveData,
			getCSSVar: vi.fn(() => ({})),
			app: { workspace: { trigger: vi.fn() } },
		} as unknown as typeof manager.plugin;
		const color = (id: string) => ({
			id,
			title: id,
			type: 'variable-color' as const,
			format: 'hex' as const,
		});
		manager.setConfig([
			{
				name: 'First',
				id: 'shared',
				collapsed: true,
				settings: [color('first')],
			},
			{
				name: 'Second',
				id: 'shared',
				collapsed: true,
				settings: [color('second')],
			},
		]);
		expect(saveData).not.toHaveBeenCalled();
		expect(manager.settings).toEqual({
			'shared@@first': '#000000',
			'shared@@second': '#ffffff',
		});
		expect(Object.keys(manager.config.shared)).toEqual(['first', 'second']);
		expect(manager.styleTag.innerText).toContain('--first: #000000;');
		expect(manager.styleTag.innerText).toContain('--second: #ffffff;');
	});
});

describe('pruning removed settings', () => {
	it('AC-15: deletes saved values of setting ids that are gone from a section that still exists', () => {
		const manager = createManager({
			'ocean@@kept': '#000000',
			'ocean@@removed': true,
			'ocean@@tint@@light': '#ffffff',
			'ocean@@tint@@dark': '#111111',
			'disabled@@spacing': 4,
		});
		manager.setConfig([
			{
				name: 'Ocean',
				id: 'ocean',
				collapsed: true,
				settings: [
					{
						id: 'kept',
						title: 'Kept',
						type: 'variable-color',
						format: 'hex',
					},
				],
			},
		]);
		const expected = {
			'ocean@@kept': '#000000',
			'disabled@@spacing': 4,
		};
		expect(manager.settings).toEqual(expected);
		expect(manager.plugin.saveData).toHaveBeenCalledExactlyOnceWith(expected);
	});

	it('AC-15: keeps every value and does not save when nothing was removed', () => {
		const manager = createManager({ 'ocean@@kept': '#000000' });
		manager.setConfig([
			{
				name: 'Ocean',
				id: 'ocean',
				collapsed: true,
				settings: [
					{
						id: 'kept',
						title: 'Kept',
						type: 'variable-color',
						format: 'hex',
					},
				],
			},
		]);
		expect(manager.settings).toEqual({ 'ocean@@kept': '#000000' });
		expect(manager.plugin.saveData).not.toHaveBeenCalled();
	});
});

describe('class defaults', () => {
	const settings: CSSSetting[] = [
		{ id: 'toggle-on', title: 'On', type: 'class-toggle', default: true },
		{ id: 'toggle-off', title: 'Off', type: 'class-toggle', default: false },
		{ id: 'toggle-none', title: 'None', type: 'class-toggle' },
		{
			id: 'layout',
			title: 'Layout',
			type: 'class-select',
			allowEmpty: true,
			options: ['layout-wide', { label: 'Narrow', value: 'layout-narrow' }],
			default: 'layout-wide',
		},
		{
			id: 'density',
			title: 'Density',
			type: 'class-select',
			allowEmpty: false,
			options: ['density-compact', 'density-cozy'],
		},
	];

	function applyClasses(saved: Record<string, SettingValue>) {
		const manager = createManager(saved);
		manager.config = {
			ocean: Object.fromEntries(settings.map((s) => [s.id, s])),
		};
		manager.initClasses();
		return [...bodyClasses].sort();
	}

	beforeEach(() => {
		bodyClasses.clear();
	});

	it('AC-20: adds default classes to body when nothing is saved', () => {
		expect(applyClasses({})).toEqual(['layout-wide', 'toggle-on']);
	});

	it('AC-20: saved values replace the defaults', () => {
		expect(
			applyClasses({
				'ocean@@toggle-on': false,
				'ocean@@toggle-off': true,
				'ocean@@layout': 'layout-narrow',
				'ocean@@density': 'density-cozy',
			})
		).toEqual(['density-cozy', 'layout-narrow', 'toggle-off']);
	});

	it('AC-13: a saved none adds no class, not even the default', () => {
		expect(applyClasses({ 'ocean@@layout': 'none' })).toEqual(['toggle-on']);
	});

	it('removeClasses removes every option and toggle class again', () => {
		const manager = createManager({ 'ocean@@density': 'density-cozy' });
		manager.config = {
			ocean: Object.fromEntries(settings.map((s) => [s.id, s])),
		};
		manager.initClasses();
		manager.removeClasses();
		expect([...bodyClasses]).toEqual([]);
	});
});
