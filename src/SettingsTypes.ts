import type { CSSSetting } from './SettingHandlers';

export type SettingValue = number | string | boolean;
export interface CSSSettings {
	[key: string]: SettingValue;
}
export interface MappedSettings {
	[sectionId: string]: { [settingId: string]: CSSSetting };
}
