import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/browser',
	timeout: 15000,
	workers: 2,
	use: {
		baseURL: 'http://127.0.0.1:4178',
		channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'node tests/browser/server.mjs',
		url: 'http://127.0.0.1:4178',
		reuseExistingServer: false,
	},
});
