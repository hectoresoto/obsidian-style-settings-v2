import { describe, expect, it, vi } from 'vitest';

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
