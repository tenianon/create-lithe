import { rm } from 'fs/promises'
import { globby } from 'globby'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

function toPosix(posix: string) {
	return posix.split(path.sep).join('/')
}

export async function deleteFile(filePaths: string[], outputDir: string) {
	const fullPaths = filePaths.map((filePath) => {
		return toPosix(path.join(outputDir, filePath))
	})

	const matchedPaths = await globby(fullPaths, {
		onlyFiles: false,
		expandDirectories: false,
		dot: true,
	})

	const directCandidates = filePaths.map((filePath) =>
		path.join(outputDir, filePath),
	)
	const candidates = new Set<string>([...matchedPaths, ...directCandidates])

	for (const p of candidates) {
		try {
			await rm(p, { recursive: true, force: true })
		} catch {}
	}

	return true
}

export async function modifyFile(
	file: string,
	callback: (text: string) => string,
	outputDir: string,
) {
	const joined = path.join(outputDir, file)
	const pattern = toPosix(joined)
	const filePath = await globby(pattern, { dot: true })

	const target = filePath[0] || joined

	const text = await readFile(target, 'utf-8')
	const newText = callback(text)
	await writeFile(target, newText)
}
