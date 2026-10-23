import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

describe('ESLint TypeScript compatibility', () => {
	it('parses TypeScript and accepts browser and Node globals', async () => {
		const [result] = await eslint.lintText(
			`
            interface Color { value: string }
            export function paint(color: Color): string {
                document.body.style.color = color.value;
                return process.platform;
            }
        `,
			{ filePath: 'src/lint-regression.ts' }
		);
		expect(result.messages).toEqual([]);
	});

	it('still reports unused TypeScript variables', async () => {
		const [result] = await eslint.lintText(
			'const unusedColor: string = "blue";',
			{
				filePath: 'src/lint-regression.ts',
			}
		);
		expect(result.fatalErrorCount).toBe(0);
		expect(result.messages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					ruleId: '@typescript-eslint/no-unused-vars',
					severity: 2,
				}),
			])
		);
	});

	it('checks TSX sources with the same TypeScript parser', async () => {
		const [result] = await eslint.lintText('export const preview = <div />;', {
			filePath: 'src/lint-regression.tsx',
		});
		expect(result.messages).toEqual([]);
	});
});
