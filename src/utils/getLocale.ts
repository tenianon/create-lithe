import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import enUS from '../locales/en-US.json'

export function getLanguage(): typeof enUS {
	const DEFAULT_LOCALE = 'en-US'

	const rawLocale =
		Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_LOCALE

	const normalizeLocale = (locale: string): string => {
		const withoutEncoding = locale.split('.')[0] || locale
		return withoutEncoding
			.replace(/_/g, '-')
			.replace(/-Hans(-|$)/, '-')
			.replace(/-Hant(-|$)/, '-')
	}

	const locale = normalizeLocale(rawLocale)

	const __dirname = path.dirname(fileURLToPath(import.meta.url))
	const localesRootPath = path.resolve(__dirname, '../locales')

	const tryLoadLocale = (localeName: string): typeof enUS | null => {
		try {
			const filePath = path.resolve(localesRootPath, `${localeName}.json`)
			const content = fs.readFileSync(filePath, 'utf-8')
			return JSON.parse(content)
		} catch {
			return null
		}
	}

	let result = tryLoadLocale(locale)
	if (result) return result

	const languageCode = locale.split('-')[0]
	if (languageCode) {
		result = tryLoadLocale(languageCode)
		if (result) return result
	}

	console.warn(
		`Language file not found for ${locale}, using default: ${DEFAULT_LOCALE}`,
	)
	return enUS
}
