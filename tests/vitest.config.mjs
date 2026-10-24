import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// This file lives in tests/, but the paths below start at the project root.
		root: fileURLToPath(new URL('..', import.meta.url)),
		include: ['src/**/*.test.ts', 'tests/tooling/**/*.test.mjs'],
	},
});
