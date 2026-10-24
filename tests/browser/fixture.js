import { CSSSettingsManager } from '../../src/settings/SettingsManager';
import { SettingsMarkup } from '../../src/settingsView/SettingsMarkup';
import '@simonwep/pickr/dist/themes/nano.min.css';
import '../../src/css/pickerOverrides.css';
import '../../src/css/settings.css';

const section = {
	id: 'ocean',
	name: 'Ocean Blue',
	collapsed: false,
	settings: [
		{
			id: 'ocean-h1',
			title: 'Heading H1',
			type: 'variable-color',
			format: 'hex',
			default: '#3B82F6',
		},
		{
			id: 'ocean-h2',
			title: 'Heading H2',
			type: 'variable-color',
			format: 'hex',
			default: '#4D93F7',
		},
		{
			id: 'tint',
			title: 'Themed tint',
			type: 'variable-themed-color',
			format: 'hex',
			opacity: true,
			'default-light': '#60A5FA80',
			'default-dark': '#93C5FD80',
		},
		{
			id: 'ocean-feature',
			title: 'Extra feature',
			type: 'class-toggle',
			default: true,
		},
		{
			id: 'spacing',
			title: 'Spacing',
			type: 'variable-number',
			default: 4,
			format: 'px',
		},
	],
};
const plugin = {
	app: { workspace: { trigger() {} } },
	loadData: async () => JSON.parse(localStorage.getItem('settings') || '{}'),
	saveData: async (value) =>
		localStorage.setItem('settings', JSON.stringify(value)),
	getCSSVar: () => ({}),
};
const manager = (plugin.settingsManager = new CSSSettingsManager(plugin));

// Obsidian opens settings in a popout window that shares this JS realm, so
// `?popout` renders them in a same-origin iframe with its own document.
async function settingsContainer() {
	if (!new URLSearchParams(location.search).has('popout')) {
		return document.querySelector('#settings');
	}
	const frame = document.body.createEl('iframe', { attr: { id: 'popout' } });
	frame.style.cssText = 'width: 100%; height: 600px; border: 0';
	const popout = frame.contentDocument;
	popout.body.className = document.body.className;
	const styles = [...document.querySelectorAll('style, link[rel=stylesheet]')];
	await Promise.all(
		styles.map((node) => {
			const copy = popout.head.appendChild(node.cloneNode(true));
			return node.tagName === 'LINK'
				? new Promise((resolve) => copy.addEventListener('load', resolve))
				: null;
		})
	);
	return popout.body.appendChild(createDiv());
}

async function start() {
	const markup = new SettingsMarkup(
		plugin.app,
		plugin,
		await settingsContainer()
	);
	plugin.settingsTab = markup;
	await manager.load();
	manager.setConfig([section]);
	manager.initClasses();
	markup.settings = [section];
	markup.load();
	window.harness = {
		manager,
		toggleSnippet(enabled) {
			manager.setConfig(enabled ? [section] : []);
			markup.setSettings(enabled ? [section] : [], []);
		},
	};
}
start();
