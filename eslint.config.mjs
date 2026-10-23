import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
	{
		ignores: [
			'node_modules/**',
			'main.js',
			'test-results/**',
			'playwright-report/**',
		],
	},
	{
		files: ['src/**/*.{ts,tsx}'],
		extends: [js.configs.recommended, tseslint.configs.recommended],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			// Preserve the existing project's deliberate rule exceptions.
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-this-alias': 'off',
			'@typescript-eslint/no-inferrable-types': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
		},
	},
]);
