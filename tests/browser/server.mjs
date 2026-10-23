import { context } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Compile the real settings UI, replacing only APIs supplied by the Obsidian host.
const build = await context({
	entryPoints: ['tests/browser/fixture.js'],
	bundle: true,
	format: 'esm',
	target: 'es2018',
	write: false,
	outfile: 'fixture.js',
	alias: { obsidian: resolve('tests/browser/obsidian.js') },
});
const output = await build.rebuild();
const bundle = output.outputFiles.find((file) =>
	file.path.endsWith('.js')
).text;
const css = output.outputFiles.find((file) => file.path.endsWith('.css')).text;
const html = await readFile('tests/browser/index.html');
createServer((req, res) => {
	const [type, body] =
		req.url === '/fixture.js'
			? ['text/javascript', bundle]
			: req.url === '/fixture.css'
			? ['text/css', css]
			: ['text/html', html];
	res.writeHead(200, { 'Content-Type': type });
	res.end(body);
}).listen(4178, '127.0.0.1');
