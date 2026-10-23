import type Pickr from '@simonwep/pickr';

const activePickers = new WeakMap<Document, Pickr>();

/** Keep one picker open per document; hide it before destroying it. */
export function bindExclusiveColorPicker(picker: Pickr, owner: Document): void {
	picker.on('show', () => {
		const previous = activePickers.get(owner);
		if (previous && previous !== picker) previous.hide();
		activePickers.set(owner, picker);
	});
	picker.on('hide', () => {
		if (activePickers.get(owner) === picker) activePickers.delete(owner);
	});
}
