import type Pickr from '@simonwep/pickr';
import { describe, expect, it, vi } from 'vitest';
import { bindExclusiveColorPicker } from './ExclusiveColorPicker';

function createPicker(owner: Document) {
	const handlers = new Map<string, () => void>();
	const picker = {
		on: (event: string, handler: () => void) => handlers.set(event, handler),
		hide: vi.fn(() => handlers.get('hide')?.()),
	};
	bindExclusiveColorPicker(picker as unknown as Pickr, owner);
	return { ...picker, show: () => handlers.get('show')?.() };
}

describe('exclusive color pickers', () => {
	it('closes the previous picker when another opens', () => {
		const owner = {} as Document;
		const first = createPicker(owner);
		const second = createPicker(owner);
		first.show();
		second.show();
		expect(first.hide).toHaveBeenCalledOnce();
		expect(second.hide).not.toHaveBeenCalled();
		first.show();
		expect(second.hide).toHaveBeenCalledOnce();
	});
	it('releases hidden pickers before they are destroyed', () => {
		const owner = {} as Document;
		const first = createPicker(owner);
		first.show();
		first.hide();
		first.hide.mockImplementation(() => { throw new Error('Destroyed picker'); });
		expect(() => createPicker(owner).show()).not.toThrow();
	});
	it('keeps separate windows independent', () => {
		const first = createPicker({} as Document);
		const second = createPicker({} as Document);
		first.show();
		second.show();
		expect(first.hide).not.toHaveBeenCalled();
	});
});
