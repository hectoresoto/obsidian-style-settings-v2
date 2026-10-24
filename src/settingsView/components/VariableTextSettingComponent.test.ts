import { describe, expect, it, vi } from 'vitest';
import type { VariableText } from '../../settings/SettingHandlers';
import type { CSSSettingsManager } from '../../settings/SettingsManager';

const { FakeElement, FakeSetting, texts } = vi.hoisted(() => {
	class FakeElement {
		dataset: Record<string, string> = {};
		remove() {}
	}

	class FakeText {
		value = '';
		changeHandler: (value: string) => void = () => {};

		setValue(value: string) {
			this.value = value;
			return this;
		}

		onChange(handler: (value: string) => void) {
			this.changeHandler = handler;
			return this;
		}

		type(value: string) {
			this.setValue(value);
			this.changeHandler(value);
		}
	}

	const texts: FakeText[] = [];

	class FakeSetting {
		settingEl = new FakeElement();
		setName() {
			return this;
		}
		setDesc() {
			return this;
		}
		addText(callback: (text: FakeText) => void) {
			const text = new FakeText();
			texts.push(text);
			callback(text);
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

	return { FakeElement, FakeSetting, texts };
});

Object.defineProperty(globalThis, 'window', {
	value: { localStorage: { getItem: () => null } },
	writable: true,
});
Object.defineProperty(globalThis, 'HTMLElement', {
	value: FakeElement,
	writable: true,
});

vi.mock('obsidian', () => ({
	Component: class {},
	Setting: FakeSetting,
	// Save on every change instead of waiting 250 ms.
	debounce: (callback: (...args: unknown[]) => void) => callback,
}));

// The description is built with Obsidian's DOM helpers, which these tests do not need.
vi.mock('../../Utils', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../Utils')>()),
	createDescription: () => '',
}));

const { VariableTextSettingComponent } = await import(
	'./VariableTextSettingComponent'
);

function render(setting: Partial<VariableText> = {}, saved?: string) {
	texts.length = 0;
	const settingsManager = {
		getSetting: vi.fn(() => saved),
		setSetting: vi.fn(),
	};
	const component = new VariableTextSettingComponent(
		new FakeElement() as unknown as HTMLElement,
		'section',
		'Section',
		{
			id: 'font',
			type: 'variable-text',
			title: 'Font',
			default: 'Inter',
			...setting,
		} as VariableText,
		settingsManager as unknown as CSSSettingsManager,
		false
	);
	component.render();
	expect(texts).toHaveLength(1);
	return { text: texts[0], settingsManager };
}

describe('variable-text input (AC-22)', () => {
	it('removes semicolons and angle brackets before saving', () => {
		const { text, settingsManager } = render();
		text.type('Inter; } body { color: red</style>');
		expect(settingsManager.setSetting).toHaveBeenCalledExactlyOnceWith(
			'section',
			'font',
			'Inter } body { color: red/style'
		);
	});

	it('saves an empty input as two double quotes', () => {
		const { text, settingsManager } = render();
		text.type('');
		expect(settingsManager.setSetting).toHaveBeenCalledExactlyOnceWith(
			'section',
			'font',
			'""'
		);
	});

	it('shows a saved empty value as an empty input when quotes is set', () => {
		const { text } = render({ quotes: true }, '""');
		expect(text.value).toBe('');
	});
});
