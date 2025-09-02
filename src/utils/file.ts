import { rm } from 'fs/promises'
import { globby } from 'globby'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function deleteFile(filePaths: string[], outputDir: string) {
	const fullPaths = filePaths.map((filePath) => {
		return path.join(outputDir, filePath)
	})

	const matchedPaths = await globby(fullPaths, {
		onlyFiles: false,
		expandDirectories: false,
		dot: true,
	})

	for (const matchedPath of matchedPaths) {
		try {
			await rm(matchedPath, { recursive: true, force: true })
		} catch (error) {}
	}

	return true
}

export async function modifyFile(
	file: string,
	callback: (text: string) => string,
	outputDir: string,
) {
	const fullPath = path.join(outputDir, file)
	const filePath = await globby(fullPath)

	const text = await readFile(filePath[0], 'utf-8')

	const newText = callback(text)

	await writeFile(filePath[0], newText)
}
