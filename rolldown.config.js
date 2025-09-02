export default {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.mjs',
		format: 'esm',
	},
	external: [
		'node:path',
		'node:fs',
		'node:fs/promises',
		'node:util',
		'node:child_process',
		'node:url',
	],
	platform: 'node',
}
