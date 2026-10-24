import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (data?: unknown) => void;
type Command = { id: string; name: string; callback: () => void };

const { FakePlugin } = vi.hoisted(() => {
	class FakePlugin {
		app: unknown;
		commands: Command[] = [];
		constructor(app: unknown) {
			this.app = app;
		}
		addSettingTab() {}
		registerView() {}
		registerEvent() {}
		addCommand(command: Command) {
			this.commands.push(command);
			return command;
		}
		async loadData() {
			return {};
		}
		async saveData() {}
	}
	return { FakePlugin };
});

vi.mock('obsidian', () => ({ Plugin: FakePlugin }));
vi.mock('./settingsView/CSSSettingsTab', () => ({
	CSSSettingsTab: class {
		setSettings() {}
		rerender() {}
	},
}));
vi.mock('./settingsView/SettingsView', () => ({
	SettingsView: class {},
	viewType: 'style-settings',
}));
vi.mock('./modals/ExportModal', () => ({ ExportModal: class {} }));
vi.mock('./modals/ImportModal', () => ({ ImportModal: class {} }));

const bodyClasses = new Set<string>();
let styleSheetTexts: string[] = [];

Object.defineProperty(globalThis, 'window', {
	value: { localStorage: { getItem: () => null } },
	writable: true,
});
Object.defineProperty(globalThis, 'activeWindow', {
	value: globalThis,
	writable: true,
});
Object.defineProperty(globalThis, 'document', {
	value: {
		createElement: () => ({ remove() {} }),
		getElementsByTagName: () => [{ appendChild() {} }],
		get styleSheets() {
			const sheets = styleSheetTexts.map((text) => ({
				ownerNode: { textContent: text },
			}));
			return { length: sheets.length, item: (i: number) => sheets[i] };
		},
		body: {
			createDiv: () => ({ remove() {} }),
			classList: {
				add: (name: string) => bodyClasses.add(name),
				remove: (name: string) => bodyClasses.delete(name),
				contains: (name: string) => bodyClasses.has(name),
			},
		},
	},
	writable: true,
});

const { default: CSSSettingsPlugin } = await import('./main');

function snippet(sectionId: string, settings: string) {
	return `/* @settings
name: ${sectionId}
id: ${sectionId}
settings:
${settings}
*/`;
}

function createApp() {
	const handlers = new Map<string, Handler[]>();
	const removeCommand = vi.fn();
	const workspace = {
		on(name: string, handler: Handler) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
			return { name, handler };
		},
		trigger(name: string, data?: unknown) {
			for (const handler of handlers.get(name) ?? []) handler(data);
		},
		onLayoutReady() {},
		getLeavesOfType: () => [],
	};
	return {
		workspace,
		commands: { removeCommand },
		plugins: { plugins: {} },
	};
}

async function loadPlugin() {
	const app = createApp();
	const plugin = new CSSSettingsPlugin(app as never, {} as never);
	await plugin.onload();
	vi.runAllTimers();
	return {
		app,
		plugin,
		commands: (plugin as unknown as InstanceType<typeof FakePlugin>).commands,
	};
}

function sectionIds(plugin: InstanceType<typeof CSSSettingsPlugin>) {
	return plugin.settingsList.map((section) => section.id);
}

beforeEach(() => {
	vi.useFakeTimers();
	bodyClasses.clear();
	styleSheetTexts = [
		snippet('first', '  - id: a\n    type: class-toggle\n    title: A'),
	];
});

afterEach(() => {
	vi.useRealTimers();
});

describe('reparsing stylesheets (AC-8)', () => {
	it('parses again when a plugin triggers parse-style-settings', async () => {
		const { app, plugin } = await loadPlugin();
		expect(sectionIds(plugin)).toEqual(['first']);

		styleSheetTexts.push(
			snippet('second', '  - id: b\n    type: class-toggle\n    title: B')
		);
		app.workspace.trigger('parse-style-settings');
		vi.runAllTimers();
		expect(sectionIds(plugin)).toEqual(['first', 'second']);
	});

	it('parses again on css-change from any other source', async () => {
		const { app, plugin } = await loadPlugin();

		styleSheetTexts = [];
		app.workspace.trigger('css-change');
		vi.runAllTimers();
		expect(sectionIds(plugin)).toEqual([]);

		styleSheetTexts = [
			snippet('second', '  - id: b\n    type: class-toggle\n    title: B'),
		];
		app.workspace.trigger('css-change', { source: 'theme' });
		vi.runAllTimers();
		expect(sectionIds(plugin)).toEqual(['second']);
	});

	it('ignores css-change events from Style Settings itself', async () => {
		const { app, plugin } = await loadPlugin();

		styleSheetTexts = [];
		app.workspace.trigger('css-change', { source: 'style-settings' });
		vi.runAllTimers();
		expect(sectionIds(plugin)).toEqual(['first']);
	});
});

describe('class toggle commands (AC-12)', () => {
	beforeEach(() => {
		styleSheetTexts = [
			snippet(
				'ocean',
				[
					'  - id: wide-mode',
					'    type: class-toggle',
					'    title: Wide mode',
					'    addCommand: true',
					'  - id: no-command',
					'    type: class-toggle',
					'    title: No command',
				].join('\n')
			),
		];
	});

	it('registers a command only for toggles with addCommand', async () => {
		const { commands } = await loadPlugin();
		expect(
			commands
				.filter((c) => c.id.startsWith('style-settings-class-toggle-'))
				.map(({ id, name }) => ({ id, name }))
		).toEqual([
			{
				id: 'style-settings-class-toggle-ocean-wide-mode',
				name: 'Toggle Wide mode',
			},
		]);
	});

	it('flips the class on body each time it runs', async () => {
		const { plugin, commands } = await loadPlugin();
		const command = commands.find(
			(c) => c.id === 'style-settings-class-toggle-ocean-wide-mode'
		);
		expect(bodyClasses.has('wide-mode')).toBe(false);

		command?.callback();
		expect(bodyClasses.has('wide-mode')).toBe(true);
		expect(plugin.settingsManager.getSetting('ocean', 'wide-mode')).toBe(true);

		command?.callback();
		expect(bodyClasses.has('wide-mode')).toBe(false);
		expect(plugin.settingsManager.getSetting('ocean', 'wide-mode')).toBe(false);
	});

	it('removes the previous commands before registering them again', async () => {
		const { app } = await loadPlugin();
		app.workspace.trigger('parse-style-settings');
		vi.runAllTimers();
		expect(app.commands.removeCommand).toHaveBeenCalledExactlyOnceWith(
			'style-settings-class-toggle-ocean-wide-mode'
		);
	});
});
