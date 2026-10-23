import { test, expect } from '@playwright/test';

const row = (page, id) => page.locator(`.setting-item[data-id="${id}"]`);
const picker = (page) => page.locator('.pcr-app.visible');
const stored = (page) =>
	page.evaluate(() => JSON.parse(localStorage.getItem('settings') || '{}'));
const runtimeErrors = new WeakMap();

async function openPicker(page, id = 'ocean-h1', index = 0) {
	await row(page, id).locator('.pcr-button').nth(index).click();
	await expect(picker(page)).toHaveCount(1);
	await expect(picker(page).locator('.pcr-result')).not.toHaveValue('');
}

async function saveColor(page, color) {
	await openPicker(page);
	await picker(page).locator('.pcr-result').fill(color);
	await picker(page).locator('.pcr-save').click();
	await expect(picker(page)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
	const errors = [];
	runtimeErrors.set(page, errors);
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	await page.goto('/');
	await expect(row(page, 'ocean-h1')).toBeVisible();
});

test.afterEach(async ({ page }) => {
	expect(runtimeErrors.get(page), 'Unexpected browser errors').toEqual([]);
});

test('initializes the default blue before opening and after reopening', async ({
	page,
}) => {
	await expect(row(page, 'ocean-h1').locator('.pcr-button')).toHaveCSS(
		'--pcr-color',
		'rgba(59, 130, 246, 1)'
	);
	await openPicker(page);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#3B82F6');
	await picker(page).locator('.pcr-cancel').click();
	await openPicker(page);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#3B82F6');
});

test('saves typed colors, applies CSS and retains them after reload', async ({
	page,
}) => {
	await saveColor(page, '#22C55E');
	await expect(page.locator('h1')).toHaveCSS('color', 'rgb(34, 197, 94)');
	await page.reload();
	await expect(page.locator('h1')).toHaveCSS('color', 'rgb(34, 197, 94)');
	await openPicker(page);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#22C55E');
});

test('cancel preserves the saved color and persistence', async ({ page }) => {
	await saveColor(page, '#22C55E');
	await openPicker(page);
	await picker(page).locator('.pcr-result').fill('#FF0000');
	await picker(page).locator('.pcr-cancel').click();
	expect((await stored(page))['ocean@@ocean-h1']).toBe('#22C55E');
	await expect(page.locator('h1')).toHaveCSS('color', 'rgb(34, 197, 94)');
	await openPicker(page);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#22C55E');
});

test('reset removes the override and restores blue after reload', async ({
	page,
}) => {
	await saveColor(page, '#22C55E');
	await row(page, 'ocean-h1')
		.getByRole('button', { name: 'Restore default', exact: true })
		.click();
	await expect(page.locator('h1')).toHaveCSS('color', 'rgb(59, 130, 246)');
	expect((await stored(page))['ocean@@ocean-h1']).toBeUndefined();
	await page.reload();
	await openPicker(page);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#3B82F6');
});

test('HEX, RGB and HSL preserve the same color', async ({ page }) => {
	await openPicker(page);
	await picker(page).locator('[data-type="RGBA"]').click();
	await expect(picker(page).locator('.pcr-result')).toHaveValue(
		'rgba(59, 130, 246, 1)'
	);
	await picker(page).locator('[data-type="HSLA"]').click();
	await expect(picker(page).locator('.pcr-result')).toHaveValue(/^hsla?\(/);
	await picker(page).locator('[data-type="HEXA"]').click();
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#3B82F6');
});

for (const value of ['hola', '#ZZZZZZ']) {
	test(`invalid input ${value} cannot corrupt a saved color`, async ({
		page,
	}) => {
		await saveColor(page, '#22C55E');
		await openPicker(page);
		await picker(page).locator('.pcr-result').fill(value);
		await expect(picker(page).locator('.pcr-result')).toHaveAttribute(
			'aria-invalid',
			'true'
		);
		await expect(picker(page).locator('.pcr-save')).toBeDisabled();
		await picker(page).locator('.pcr-result').press('Tab');
		await picker(page).locator('.pcr-save').click();
		expect((await stored(page))['ocean@@ocean-h1']).toBe('#22C55E');
		await expect(page.locator('h1')).toHaveCSS('color', 'rgb(34, 197, 94)');
	});
}

test('opening another regular or themed picker closes the previous one', async ({
	page,
}) => {
	await openPicker(page);
	await openPicker(page, 'ocean-h2');
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#4D93F7');
	await openPicker(page, 'tint', 0);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#60A5FA80');
	await openPicker(page, 'tint', 1);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#93C5FD80');
});

test('themed alpha colors persist and reset independently', async ({
	page,
}) => {
	await openPicker(page, 'tint', 0);
	await picker(page).locator('.pcr-result').fill('#22C55E80');
	await picker(page).locator('.pcr-save').click();
	await page.reload();
	await openPicker(page, 'tint', 0);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#22C55E80');
	await picker(page).locator('.pcr-cancel').click();
	await row(page, 'tint')
		.getByRole('button', { name: 'Restore default', exact: true })
		.first()
		.click();
	await openPicker(page, 'tint', 0);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#60A5FA80');
	await openPicker(page, 'tint', 1);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#93C5FD80');
});

test('search handles matches, no results, clearing and picker destruction', async ({
	page,
}) => {
	await openPicker(page);
	const search = page.getByPlaceholder('Search Style Settings...');
	await search.fill('Heading H2');
	await expect(row(page, 'ocean-h1')).toHaveCount(0);
	await expect(row(page, 'ocean-h2')).toBeVisible();
	await expect(picker(page)).toHaveCount(0);
	await search.fill('zzzznothingmatches');
	await expect(page.locator('.style-settings-filter-result-count')).toHaveText(
		'0 Results'
	);
	await search.fill('');
	await expect(page.locator('.style-settings-filter-result-count')).toBeEmpty();
	await page.locator('.style-settings-heading').click();
	await openPicker(page);
});

test('export/import round trip restores colors, false and zero', async ({
	page,
}) => {
	await saveColor(page, '#22C55E');
	await row(page, 'ocean-feature').locator('input').uncheck();
	await row(page, 'spacing').locator('input').fill('0');
	await expect.poll(async () => (await stored(page))['ocean@@spacing']).toBe(0);
	await page.locator('.style-settings-export').click();
	const exported = await page.locator('.modal textarea').inputValue();
	const data = JSON.parse(exported);
	expect(data['ocean@@ocean-feature']).toBe(false);
	expect(data['ocean@@spacing']).toBe(0);
	await page.reload();
	await saveColor(page, '#FF0000');
	await page.locator('.style-settings-import').click();
	await page.locator('.modal textarea').fill(exported);
	await page
		.locator('.modal')
		.getByRole('button', { name: 'Save', exact: true })
		.click();
	await expect(page.locator('.modal')).toHaveCount(0);
	await expect(page.locator('h1')).toHaveCSS('color', 'rgb(34, 197, 94)');
	expect(await stored(page)).toEqual(data);
});

test('section exports include false and zero overrides', async ({ page }) => {
	await row(page, 'ocean-feature').locator('input').uncheck();
	await row(page, 'spacing').locator('input').fill('0');
	await expect.poll(async () => (await stored(page))['ocean@@spacing']).toBe(0);
	await page
		.locator('.style-settings-heading')
		.getByRole('button', { name: 'Export settings', exact: true })
		.click();
	const data = JSON.parse(await page.locator('.modal textarea').inputValue());
	expect(data['ocean@@ocean-feature']).toBe(false);
	expect(data['ocean@@spacing']).toBe(0);
});

test('imports a JSON file through the real import dialog', async ({ page }) => {
	await page.locator('.style-settings-import').click();
	await page.locator('.modal input[type="file"]').setInputFiles({
		name: 'style-settings.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ 'ocean@@ocean-h1': '#22C55E' })),
	});
	await expect(page.locator('.modal')).toHaveCount(0);
	await expect(page.locator('h1')).toHaveCSS('color', 'rgb(34, 197, 94)');
});

test('correcting invalid input enables saving again', async ({ page }) => {
	await openPicker(page);
	await picker(page).locator('.pcr-result').fill('hola');
	await expect(picker(page).locator('.pcr-save')).toBeDisabled();
	await picker(page).locator('.pcr-result').fill('#22C55E');
	await expect(picker(page).locator('.pcr-result')).not.toHaveAttribute(
		'aria-invalid'
	);
	await expect(picker(page).locator('.pcr-save')).toBeEnabled();
	await picker(page).locator('.pcr-save').click();
	await expect(page.locator('h1')).toHaveCSS('color', 'rgb(34, 197, 94)');
});

test('Escape closes the picker without saving a draft', async ({ page }) => {
	await openPicker(page);
	await picker(page).locator('.pcr-result').fill('#FF0000');
	await page.keyboard.press('Escape');
	await expect(picker(page)).toHaveCount(0);
	expect(await stored(page)).toEqual({});
	await expect(page.locator('h1')).toHaveCSS('color', 'rgb(59, 130, 246)');
});

test('invalid JSON shows an import error without changing saved settings', async ({
	page,
}) => {
	await saveColor(page, '#22C55E');
	const before = await stored(page);
	await page.locator('.style-settings-import').click();
	await page.locator('.modal textarea').fill('{broken');
	await page
		.locator('.modal')
		.getByRole('button', { name: 'Save', exact: true })
		.click();
	await expect(
		page.locator('.style-settings-import-error.active')
	).toBeVisible();
	expect(await stored(page)).toEqual(before);
});

test('changing snippet configuration removes and restores its settings', async ({
	page,
}) => {
	await saveColor(page, '#22C55E');
	await openPicker(page);
	await page.evaluate(() => window.harness.toggleSnippet(false));
	await expect(picker(page)).toHaveCount(0);
	await expect(page.getByText('No style settings found')).toBeVisible();
	await page.evaluate(() => window.harness.toggleSnippet(true));
	await openPicker(page);
	await expect(picker(page).locator('.pcr-result')).toHaveValue('#22C55E');
});

test('picker follows light/dark theme and fits a narrow window', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 700 });
	await openPicker(page);
	await expect(picker(page)).toHaveCSS('background-color', 'rgb(30, 30, 30)');
	await page.evaluate(() => {
		document.body.classList.replace('theme-dark', 'theme-light');
	});
	await expect(picker(page)).toHaveCSS(
		'background-color',
		'rgb(255, 255, 255)'
	);
	const bounds = await picker(page).boundingBox();
	expect(bounds.x).toBeGreaterThanOrEqual(0);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
	expect(
		await picker(page).evaluate((el) => el.scrollWidth <= el.clientWidth)
	).toBe(true);
});

// Obsidian renders settings in popout windows; Pickr must track the mouse and
// keyboard in the document that owns the picker, not the main document.
for (const popout of [false, true]) {
	const where = popout ? 'in a popout window' : 'in the main window';
	async function openIn(page) {
		if (popout) await page.goto('/?popout');
		const root = popout ? page.frameLocator('#popout') : page;
		await openPicker(root);
		return root;
	}

	for (const [name, control] of [
		['hue slider', '.pcr-color-chooser'],
		['palette', '.pcr-color-palette'],
	]) {
		test(`dragging the ${name} follows the mouse ${where}`, async ({
			page,
		}) => {
			const root = await openIn(page);
			const result = picker(root).locator('.pcr-result');
			const area = picker(root).locator(
				`${control} .pcr-slider, ${control} .pcr-palette`
			);
			const box = await area.boundingBox();
			const y = box.y + box.height / 2;
			await page.mouse.move(box.x + box.width * 0.1, y);
			await page.mouse.down();
			const afterPress = await result.inputValue();
			await page.mouse.move(box.x + box.width * 0.9, y, { steps: 10 });
			// The knob must follow while the button is still held.
			const knob = await picker(root)
				.locator(`${control} .pcr-picker`)
				.boundingBox();
			expect(knob.x + knob.width / 2).toBeGreaterThan(box.x + box.width * 0.8);
			await expect(result).not.toHaveValue(afterPress);
			await page.mouse.up();
			await expect(picker(root)).toHaveCount(1);
		});
	}

	test(`arrow keys move the focused hue slider ${where}`, async ({ page }) => {
		const root = await openIn(page);
		const result = picker(root).locator('.pcr-result');
		const before = await result.inputValue();
		await picker(root).locator('.pcr-color-chooser .pcr-slider').focus();
		await page.keyboard.press('ArrowRight', { delay: 10 });
		await page.keyboard.press('ArrowRight', { delay: 10 });
		await expect(result).not.toHaveValue(before);
	});

	test(`clicking outside closes the picker ${where}`, async ({ page }) => {
		const root = await openIn(page);
		await row(root, 'ocean-h2').getByText('Heading H2').click();
		await expect(picker(root)).toHaveCount(0);
		expect(await stored(page)).toEqual({});
	});

	test(`Escape closes the picker from its sliders ${where}`, async ({
		page,
	}) => {
		const root = await openIn(page);
		await picker(root).locator('.pcr-color-chooser .pcr-slider').focus();
		await page.keyboard.press('Escape');
		await expect(picker(root)).toHaveCount(0);
		expect(await stored(page)).toEqual({});
	});
}
