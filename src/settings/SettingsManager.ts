import { ExportModal } from '../modals/ExportModal';
import { ImportModal } from '../modals/ImportModal';
import type {
	ClassMultiToggle,
	ClassToggle,
	ColorGradient,
	ParsedCSSSettings,
} from './SettingHandlers';
import type {
	CSSSettings,
	MappedSettings,
	SettingValue,
} from './SettingsTypes';
import { generateStyles, type ThemeVariables } from './StyleGenerator';
import type CSSSettingsPlugin from '../main';
import { SettingType } from './SettingType';

// Keep existing import paths available to settings controls and integrations.
export type {
	CSSSettings,
	MappedSettings,
	SettingValue,
} from './SettingsTypes';
export { generateColorVariables, safeNum, safeRound } from './StyleGenerator';

export class CSSSettingsManager {
	settings: CSSSettings;
	plugin: CSSSettingsPlugin;
	styleTag: HTMLStyleElement;
	config: MappedSettings = {};
	gradients: Record<string, ColorGradient[]> = {};

	constructor(plugin: CSSSettingsPlugin) {
		this.plugin = plugin;
		this.settings = {};
		this.styleTag = document.createElement('style');
		this.styleTag.id = 'css-settings-manager';

		document.getElementsByTagName('head')[0].appendChild(this.styleTag);
	}

	cleanup() {
		this.styleTag.remove();
		this.removeClasses();
	}

	async save() {
		await this.plugin.saveData(this.settings);
		this.setCSSVariables();
	}

	async load() {
		this.settings = Object.assign({}, await this.plugin.loadData());
	}

	initClasses() {
		Object.keys(this.config).forEach((section) => {
			const config = this.config[section];

			Object.keys(config).forEach((settingId) => {
				const setting = config[settingId];

				if (setting.type === SettingType.CLASS_TOGGLE) {
					const classToggle = setting as ClassToggle;
					const value = this.getSetting(section, settingId) as
						| boolean
						| undefined;
					if (
						value === true ||
						(value === undefined && classToggle.default === true)
					) {
						document.body.classList.add(setting.id);
					}
				} else if (setting.type === SettingType.CLASS_SELECT) {
					const multiToggle = setting as ClassMultiToggle;
					let value = this.getSetting(section, settingId) as string | undefined;

					if (value === undefined && !!multiToggle.default) {
						value = multiToggle.default;
					} else if (value === undefined) {
						value = 'none';
					}

					if (value !== 'none') {
						document.body.classList.add(value);
					}
				}
			});
		});
	}

	removeClasses() {
		Object.keys(this.config).forEach((section) => {
			const config = this.config[section];

			Object.keys(config).forEach((settingId) => {
				const setting = config[settingId];

				if (setting.type === SettingType.CLASS_TOGGLE) {
					document.body.classList.remove(setting.id);
				} else if (setting.type === SettingType.CLASS_SELECT) {
					const multiToggle = setting as ClassMultiToggle;
					if (Array.isArray(multiToggle.options)) {
						multiToggle.options.forEach((v) => {
							if (typeof v === 'string') {
								document.body.classList.remove(v);
							} else {
								document.body.classList.remove(v.value);
							}
						});
					}
				}
			});
		});
	}

	setCSSVariables() {
		// Read each gradient endpoint once, before applying the newly generated CSS.
		const themeVariables: ThemeVariables = {};
		for (const gradients of Object.values(this.gradients)) {
			for (const { to } of gradients) {
				if (!Object.prototype.hasOwnProperty.call(themeVariables, to)) {
					themeVariables[to] = this.plugin.getCSSVar(to);
				}
			}
		}
		const { cssText, warnings } = generateStyles({
			settings: this.settings,
			config: this.config,
			gradients: this.gradients,
			themeVariables,
		});
		for (const warning of warnings) console.warn(warning);
		this.styleTag.innerText = cssText;
		this.plugin.app.workspace.trigger('css-change', {
			source: 'style-settings',
		});
	}

	setConfig(settings: ParsedCSSSettings[]) {
		this.config = {};
		this.gradients = {};

		settings.forEach((s) => {
			// Blocks that share a section id are merged instead of replacing each other.
			if (!this.config[s.id]) this.config[s.id] = {};
			if (Array.isArray(s.settings)) {
				s.settings.forEach((setting) => {
					this.config[s.id][setting.id] = setting;

					if (setting.type === SettingType.COLOR_GRADIENT) {
						if (!this.gradients[s.id]) this.gradients[s.id] = [];
						this.gradients[s.id].push(setting as ColorGradient);
					}
				});
			}
		});

		let pruned = false;

		for (const key in this.settings) {
			const [sectionId, settingId] = key.split('@@');

			if (this.config[sectionId] && !this.config[sectionId][settingId]) {
				delete this.settings[key];
				pruned = true;
			}
		}

		if (pruned) {
			this.save();
		} else {
			this.setCSSVariables();
		}
	}

	getSetting(sectionId: string, settingId: string): SettingValue | undefined {
		return this.settings[`${sectionId}@@${settingId}`];
	}

	getSettings(sectionId: string, ids: string[]) {
		return ids.reduce<Record<string, SettingValue>>((settings, id) => {
			const fullId = `${sectionId}@@${id}`;
			const alts = ['dark', 'light'];

			if (this.settings[fullId] !== undefined) {
				settings[fullId] = this.settings[fullId];
			}

			alts.forEach((alt) => {
				const id = `${fullId}@@${alt}`;

				if (this.settings[id] !== undefined) {
					settings[id] = this.settings[id];
				}
			});

			return settings;
		}, {});
	}

	setSetting(sectionId: string, settingId: string, value: SettingValue) {
		this.settings[`${sectionId}@@${settingId}`] = value;
		this.save();
		this.removeClasses();
		this.initClasses();
	}

	setSettings(settings: Record<string, SettingValue>) {
		Object.keys(settings).forEach((id) => {
			this.settings[id] = settings[id];
		});

		this.removeClasses();
		this.initClasses();

		return this.save();
	}

	clearSetting(sectionId: string, settingId: string) {
		delete this.settings[`${sectionId}@@${settingId}`];
		this.save();
		this.removeClasses();
		this.initClasses();
	}

	clearSection(sectionId: string) {
		Object.keys(this.settings).forEach((key) => {
			const [section] = key.split('@@');
			if (section === sectionId) {
				delete this.settings[key];
			}
		});
		this.save();
		this.removeClasses();
		this.initClasses();
	}

	export(section: string, config: Record<string, SettingValue>) {
		new ExportModal(this.plugin.app, this.plugin, section, config).open();
	}

	import() {
		new ImportModal(this.plugin.app, this.plugin).open();
	}
}
