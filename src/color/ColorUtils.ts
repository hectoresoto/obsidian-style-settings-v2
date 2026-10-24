export function isValidDefaultColor(color: string) {
	return /^(#|rgb|hsl)/.test(color);
}

/**
 * Validates a saved color value before persisting or applying it.
 * Stricter than isValidDefaultColor: rejects obviously corrupt values
 * such as strings containing "NaN" that can result from a broken color picker.
 */
export function isValidSavedColor(color: string): boolean {
	if (!isValidDefaultColor(color)) return false;
	if (/NaN/i.test(color)) return false;
	return true;
}
