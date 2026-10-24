import { defineConfig } from '@playwright/test';

// Relative paths here start at this file's folder (tests/).
export default defineConfig({
	testDir: './browser',
	outputDir: './test-results',
	timeout: 15000,
	workers: 2,
	use: {
		baseURL: 'http://127.0.0.1:4178',
		channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'node tests/browser/server.mjs',
		cwd: '..',
		url: 'http://127.0.0.1:4178',
		reuseExistingServer: false,
	},
});
