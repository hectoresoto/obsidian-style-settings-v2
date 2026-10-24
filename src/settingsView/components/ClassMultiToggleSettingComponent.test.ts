import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassMultiToggle } from '../../settings/SettingHandlers';
import type { CSSSettingsManager } from '../../settings/SettingsManager';

const { FakeElement, FakeSetting, dropdowns } = vi.hoisted(() => {
	class FakeElement {
		dataset: Record<string, string> = {};
		remove() {}
	}

	class FakeDropdown {
		options: Array<{ value: string; label: string }> = [];
		value = '';
		changeHandler: (value: string) => void = () => {};

		addOption(value: string, label: string) {
			this.options.push({ value, label });
			return this;
		}

		setValue(value: string) {
			this.value = value;
			return this;
		}

		onChange(handler: (value: string) => void) {
			this.changeHandler = handler;
			return this;
		}

		select(value: string) {
			this.setValue(value);
			this.changeHandler(value);
		}
	}

	const dropdowns: FakeDropdown[] = [];

	class FakeSetting {
		settingEl = new FakeElement();
		setName() {
			return this;
		}
		setDesc() {
			return this;
		}
		addDropdown(callback: (dropdown: FakeDropdown) => void) {
			const dropdown = new FakeDropdown();
			dropdowns.push(dropdown);
			callback(dropdown);
			return this;
		}
		addExtraButton(callback: (button: unknown) => void) {
			const button = {
				setIcon: () => button,
				setTooltip: () => button,
				onClick: () => button,
			};
			callback(button);
			return this;
		}
	}

	return { FakeElement, FakeSetting, dropdowns };
});

Object.defineProperty(globalThis, 'window', {
	value: { localStorage: { getItem: () => null } },
	writable: true,
});
Object.defineProperty(globalThis, 'HTMLElement', {
	value: FakeElement,
	writable: true,
});

vi.mock('obsidian', () => ({ Component: class {}, Setting: FakeSetting }));

// The description is built with Obsidian's DOM helpers, which these tests do not need.
vi.mock('../../Utils', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../Utils')>()),
	createDescription: () => '',
}));

const { ClassMultiToggleSettingComponent } = await import(
	'./ClassMultiToggleSettingComponent'
);

function renderSetting(setting: Partial<ClassMultiToggle>, saved?: string) {
	dropdowns.length = 0;
	const settingsManager = {
		getSetting: vi.fn(() => saved),
		setSetting: vi.fn(),
	};
	const component = new ClassMultiToggleSettingComponent(
		new FakeElement() as unknown as HTMLElement,
		'section',
		'Section',
		{
			id: 'layout',
			type: 'class-select',
			title: 'Layout',
			allowEmpty: false,
			options: ['layout-wide', { label: 'Narrow', value: 'layout-narrow' }],
			default: 'layout-wide',
			...setting,
		} as ClassMultiToggle,
		settingsManager as unknown as CSSSettingsManager,
		false
	);
	component.render();
	return settingsManager;
}

function render(setting: Partial<ClassMultiToggle>, saved?: string) {
	const settingsManager = renderSetting(setting, saved);
	expect(dropdowns).toHaveLength(1);
	return { dropdown: dropdowns[0], settingsManager };
}

describe('class-select dropdown (AC-13)', () => {
	beforeEach(() => {
		dropdowns.length = 0;
	});

	it('starts with an empty option stored as none when allowEmpty is true', () => {
		const { dropdown } = render({ allowEmpty: true });
		expect(dropdown.options).toEqual([
			{ value: 'none', label: '' },
			{ value: 'layout-wide', label: 'layout-wide' },
			{ value: 'layout-narrow', label: 'Narrow' },
		]);
	});

	it('has no empty option when allowEmpty is false', () => {
		const { dropdown } = render({ allowEmpty: false });
		expect(dropdown.options.map((o) => o.value)).toEqual([
			'layout-wide',
			'layout-narrow',
		]);
	});

	it('saves none when the empty option is chosen', () => {
		const { dropdown, settingsManager } = render({ allowEmpty: true });
		dropdown.select('none');
		expect(settingsManager.setSetting).toHaveBeenCalledExactlyOnceWith(
			'section',
			'layout',
			'none'
		);
	});

	it('shows a saved none as the empty option', () => {
		const { dropdown } = render({ allowEmpty: true }, 'none');
		expect(dropdown.value).toBe('none');
	});
});

describe('class-select without a default (AC-30)', () => {
	it.each([true, false])(
		'shows no control and logs an error when allowEmpty is %s',
		(allowEmpty) => {
			const error = vi.spyOn(console, 'error').mockImplementation(() => {});
			renderSetting({ allowEmpty, default: undefined });
			expect(dropdowns).toHaveLength(0);
			expect(error).toHaveBeenCalledExactlyOnceWith(
				'Error: Layout missing default value'
			);
			error.mockRestore();
		}
	);
});
