// Minimal host adapter: DOM helpers and controls supplied by Obsidian.
// Settings, filtering, modals, persistence logic and Pickr come from production code.
function create(tag, options = {}, callback) {
	const el = document.createElement(tag);
	if (options.cls) el.className = options.cls;
	if (options.text) el.textContent = options.text;
	for (const [key, value] of Object.entries(options.attr || {}))
		el.setAttribute(key, value);
	if (options.href) el.setAttribute('href', options.href);
	callback?.(el);
	return el;
}
for (const prototype of [HTMLElement.prototype, DocumentFragment.prototype]) {
	prototype.createEl = function (tag, options, callback) {
		const el = create(tag, options);
		this.appendChild(el);
		callback?.(el);
		return el;
	};
	prototype.createDiv = function (options, callback) {
		return this.createEl('div', options, callback);
	};
	prototype.createSpan = function (options, callback) {
		return this.createEl('span', options, callback);
	};
	prototype.empty = function () {
		this.replaceChildren();
	};
	prototype.appendText = function (text) {
		this.appendChild(document.createTextNode(text));
	};
}
HTMLElement.prototype.addClass = function (cls) {
	this.classList.add(cls);
};
HTMLElement.prototype.removeClass = function (cls) {
	this.classList.remove(cls);
};
HTMLElement.prototype.toggleClass = function (cls, value) {
	this.classList.toggle(cls, value);
};
HTMLElement.prototype.setText = function (text) {
	this.textContent = text;
};
HTMLElement.prototype.onClickEvent = function (callback) {
	this.addEventListener('click', callback);
};
window.createEl = create;
window.createSpan = (options) => create('span', options);
window.createDiv = (options) => create('div', options);
window.createFragment = (callback) => {
	const el = document.createDocumentFragment();
	callback?.(el);
	return el;
};
window.activeWindow = window;

export class Component {
	_children = new Set();
	loaded = false;
	load() {
		if (!this.loaded) {
			this.loaded = true;
			this.onload?.();
			for (const child of this._children) child.load();
		}
	}
	unload() {
		if (this.loaded) {
			for (const child of [...this._children]) this.removeChild(child);
			this.onunload?.();
			this.loaded = false;
		}
	}
	addChild(child) {
		this._children.add(child);
		if (this.loaded) child.load();
		return child;
	}
	removeChild(child) {
		if (this._children.delete(child)) child.unload();
	}
}
export class ButtonComponent {
	constructor(parent) {
		this.buttonEl = parent.createEl('button');
		this.extraSettingsEl = this.buttonEl;
	}
	then(callback) {
		callback(this);
		return this;
	}
	setButtonText(text) {
		this.buttonEl.textContent = text;
		return this;
	}
	setIcon(icon) {
		this.buttonEl.textContent = icon;
		return this;
	}
	setTooltip(text) {
		this.buttonEl.setAttribute('aria-label', text);
		return this;
	}
	onClick(callback) {
		this.buttonEl.addEventListener('click', callback);
		return this;
	}
}
export class TextComponent {
	constructor(parent, tag = 'input') {
		this.inputEl = parent.createEl(tag);
	}
	then(callback) {
		callback(this);
		return this;
	}
	setValue(value) {
		this.inputEl.value = value;
		return this;
	}
	getValue() {
		return this.inputEl.value;
	}
	setPlaceholder(text) {
		this.inputEl.placeholder = text;
		return this;
	}
	onChange(callback) {
		this.inputEl.addEventListener('input', () => callback(this.inputEl.value));
		return this;
	}
}
export class TextAreaComponent extends TextComponent {
	constructor(parent) {
		super(parent, 'textarea');
	}
}
export class ToggleComponent extends TextComponent {
	constructor(parent) {
		super(parent);
		this.inputEl.type = 'checkbox';
	}
	setValue(value) {
		this.inputEl.checked = value;
		return this;
	}
	onChange(callback) {
		this.inputEl.addEventListener('change', () =>
			callback(this.inputEl.checked)
		);
		return this;
	}
}
export class DropdownComponent extends TextComponent {
	constructor(parent) {
		super(parent, 'select');
	}
	addOption(value, text) {
		this.inputEl.add(new Option(text, value));
		return this;
	}
	onChange(callback) {
		this.inputEl.addEventListener('change', () => callback(this.inputEl.value));
		return this;
	}
}
export class SliderComponent extends TextComponent {}
export class Setting {
	constructor(parent) {
		this.settingEl = parent.createDiv({ cls: 'setting-item' });
		const info = this.settingEl.createDiv();
		this.nameEl = info.createDiv();
		this.descEl = info.createDiv({ cls: 'setting-item-description' });
		this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
	}
	then(callback) {
		callback(this);
		return this;
	}
	setName(text) {
		this.nameEl.textContent = text;
		return this;
	}
	setDesc(value) {
		this.descEl.replaceChildren(value);
		return this;
	}
	setClass(cls) {
		this.settingEl.classList.add(cls);
		return this;
	}
	setHeading() {
		this.settingEl.classList.add('setting-item-heading');
		return this;
	}
	addExtraButton(callback) {
		callback(new ButtonComponent(this.controlEl));
		return this;
	}
	addSearch(callback) {
		callback(new TextComponent(this.controlEl));
		return this;
	}
	addText(callback) {
		callback(new TextComponent(this.controlEl));
		return this;
	}
	addToggle(callback) {
		callback(new ToggleComponent(this.controlEl));
		return this;
	}
	addDropdown(callback) {
		callback(new DropdownComponent(this.controlEl));
		return this;
	}
}
export class Modal {
	constructor() {
		this.modalEl = create('div', { cls: 'modal' });
		this.contentEl = this.modalEl.createDiv();
	}
	open() {
		document.body.appendChild(this.modalEl);
		this.onOpen();
	}
	close() {
		this.onClose?.();
		this.modalEl.remove();
	}
}
export class App {}
export const MarkdownRenderer = {};
export function setIcon(el, icon) {
	el.textContent = icon;
}
export function debounce(callback, delay) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => callback(...args), delay);
	};
}
