import type Pickr from '@simonwep/pickr';
import chroma from 'chroma-js';

/** Reject invalid text before Pickr can turn it into a different color. */
export function bindColorPickerInput(picker: Pickr): void {
	const { result, save } = (
		picker.getRoot() as unknown as {
			interaction: { result: HTMLInputElement; save: HTMLInputElement };
		}
	).interaction;
	const clearError = () => {
		result.removeAttribute('aria-invalid');
		save.disabled = false;
	};
	const validate = (event: Event) => {
		if (!chroma.valid(result.value.trim())) {
			// Capture runs before Pickr's input/keyup handlers.
			event.stopImmediatePropagation();
			result.setAttribute('aria-invalid', 'true');
			save.disabled = true;
		} else {
			clearError();
		}
	};
	result.addEventListener('input', validate, true);
	result.addEventListener('keyup', validate, true);
	// Pickr consumes keyup inside the text field before its document Escape handler.
	result.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			picker.hide();
		}
	});
	// Pickr restores its last valid value on blur before this listener runs.
	result.addEventListener('blur', clearError);
}
