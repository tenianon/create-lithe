import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import enUS from '../locales/en-US.json'

export function getLanguage(): typeof enUS {
	const DEFAULT_LOCALE = 'en-US'

	const locale =
		Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_LOCALE

	const __dirname = path.dirname(fileURLToPath(import.meta.url))
	const localesRootPath = path.resolve(__dirname, '../src/locales')
	const languageFilePath = path.resolve(
		localesRootPath,
		`${locale || DEFAULT_LOCALE}.json`,
	)

	try {
		const content = fs.readFileSync(languageFilePath, 'utf-8')
		return JSON.parse(content)
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error)

		console.error(
			`Language file loading failed: ${errorMessage}, use default locale: ${DEFAULT_LOCALE}`,
		)

		return enUS
	}
}
