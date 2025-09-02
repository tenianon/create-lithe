import path from 'node:path'
import * as prompts from '@clack/prompts'
import { getLanguage } from './utils/getLocale'
import chalk from 'chalk'

import type { Option } from '@clack/prompts'
import { mkdir } from 'node:fs/promises'
import { createWriteStream, existsSync } from 'node:fs'
import { Unzip, UnzipInflate } from 'fflate/node'
import { deleteFile, modifyFile } from './utils/file'
import { getPackageManager } from './utils/getPackageManager'
import { sleep } from './utils/sleep'

type TemplateOptionValue = 'default' | 'lite'

interface ModifyFile {
	path: string
	handle: (text: string, args: any) => string
}

type Template = {
	value: TemplateOptionValue
	link: string
	deleteFile?: string[]
	modifyFile?: ModifyFile[]
}

const currentDir = path.resolve('.')
const isRootDir = currentDir === path.parse(currentDir).root

const ISSUE_URL = 'https://github.com/tenianon/lithe-admin/issues'

const DEFAULT_PROJECT_NAME = 'my-lithe-admin'

function stripTopDirectory(name: string): string {
	const idx = name.indexOf('/')
	return idx >= 0 ? name.slice(idx + 1) : name
}

function getSafeDestinationPath(
	rootDir: string,
	relativePath: string,
	language: ReturnType<typeof getLanguage>,
): string {
	const cleaned = relativePath.replace(/^\/+/, '')
	const normalizedRoot = path.resolve(rootDir)
	const full = path.resolve(normalizedRoot, cleaned)
	if (full !== normalizedRoot && !full.startsWith(normalizedRoot + path.sep)) {
		throw new Error(`${language.extractErrorPath}: ${relativePath}`)
	}
	return full
}

async function extractZipFromUrl(
	zipUrl: string,
	outputDir: string,
	language: ReturnType<typeof getLanguage>,
) {
	const unzip = new Unzip()
	unzip.register(UnzipInflate)

	const fileWrites: Promise<void>[] = []

	unzip.onfile = (file) => {
		const relativePath = stripTopDirectory(file.name)
		if (!relativePath) return
		if (relativePath.endsWith('/')) {
			void mkdir(path.join(outputDir, relativePath), { recursive: true })
			return
		}

		let destinationPath: string
		try {
			destinationPath = getSafeDestinationPath(
				outputDir,
				relativePath,
				language,
			)
		} catch {
			return
		}

		const task = (async () => {
			await mkdir(path.dirname(destinationPath), { recursive: true })
			const writeStream = createWriteStream(destinationPath)

			await new Promise<void>((resolve, reject) => {
				writeStream.on('finish', resolve)
				writeStream.on('error', reject)

				file.ondata = (err, chunk, final) => {
					if (err) {
						writeStream.destroy(err)
						reject(err)
						return
					}
					if (chunk && chunk.byteLength > 0) {
						writeStream.write(Buffer.from(chunk))
					}
					if (final) {
						writeStream.end()
					}
				}
				file.start()
			})
		})()

		fileWrites.push(task)
	}

	const response = await fetch(zipUrl)
	if (!response.ok || !response.body) {
		throw new Error(
			`${language.templateDownloadError}: ${response.status} ${response.statusText}`,
		)
	}

	await mkdir(outputDir, { recursive: true })

	const reader = response.body.getReader()
	for (;;) {
		const { value, done } = await reader.read()
		if (done) break
		if (value) unzip.push(value)
	}
	unzip.push(new Uint8Array(0), true)

	await Promise.all(fileWrites)
}

async function downdownZipPackage(
	pathSuffix: string,
	outputDir: string,
	language: ReturnType<typeof getLanguage>,
	spinner: ReturnType<typeof prompts.spinner>,
): Promise<void> {
	const proxyPool = [
		'https://gh-proxy.com',
		'https://edgeone.gh-proxy.com',
		'https://hk.gh-proxy.com',
		'https://cdn.gh-proxy.com',
	]

	let lastError: unknown

	const TRY_MAX = 3

	for (const [index, base] of proxyPool.entries()) {
		const url = `${base}/${pathSuffix}`
		for (let attempt = 1; attempt <= TRY_MAX; attempt++) {
			spinner.start(chalk.hex('#00a6f4')(language.templateDownloadStart))
			try {
				await extractZipFromUrl(url, outputDir, language)
				return
			} catch (error) {
				lastError = error
				if (attempt < TRY_MAX) {
					spinner.stop(
						chalk.hex('#f6339a')(language.templateDownloadErrorTryAgain),
					)
				} else if (attempt === TRY_MAX && index < proxyPool.length - 1) {
					spinner.stop(
						chalk.hex('#f6339a')(language.templateDownloadErrorSwitchProxy),
					)
				}
				await sleep(500 * attempt)
			}
		}
	}
	spinner.stop(
		chalk.hex('#fb2c36')(`${language.templateDownloadFailed} `) +
			chalk.hex('#ffb900').underline(`${ISSUE_URL}`),
		1,
	)
	throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function bootstrap() {
	const language = getLanguage()

	// 1. input project name
	const projectName = await prompts.text({
		message: chalk.hex('#2b7fff')(language.projectNameInput),
		placeholder: DEFAULT_PROJECT_NAME,
		defaultValue: DEFAULT_PROJECT_NAME,
		validate: (value: string) => {
			const name = value.trim() || DEFAULT_PROJECT_NAME

			if (name === '.' && isRootDir) {
				return language.projectNameErrorPath
			} else if (name !== '.') {
				if (!name.match(/^[a-zA-Z0-9-_]+$/)) {
					return language.projectNameErrorName
				}
				const target = path.resolve(currentDir, name)
				if (existsSync(target)) {
					return language.projectNameErrorExists
				}
			}
		},
	})

	if (prompts.isCancel(projectName)) {
		prompts.cancel(language.projectNameCancelInput)
		process.exit(0)
	}

	const templateOptions: Option<TemplateOptionValue>[] = [
		{
			value: 'default',
			label: chalk.hex('#8e51ff')(language.templateNormal),
			hint: language.templateNormalHint,
		},
		{
			value: 'lite',
			label: chalk.hex('#00bba7')(language.templateLite),
			hint: language.templateLiteHint,
		},
	]

	// 2. select template
	const template = await prompts.select({
		message: chalk.hex('#2b7fff')(language.projectTemplateSelect),
		options: templateOptions,
	})

	if (prompts.isCancel(template)) {
		prompts.cancel(language.projectNameCancelSelect)
		process.exit(0)
	}

	const outputDir = projectName === '.' ? currentDir : projectName
	const finalProjectName =
		projectName === '.' ? path.basename(currentDir) : projectName

	const templateList: Template[] = [
		{
			value: 'default',
			link: 'https://github.com/tenianon/lithe-admin/archive/refs/heads/main.zip',
			deleteFile: [
				'.deepsource.toml',
				'vercel.json',
				'LICENSE',
				'pnpm-lock.yaml',
			],
			modifyFile: [
				{
					path: 'package.json',
					handle: (text, args) => {
						const json = JSON.parse(text)
						json.name = args.projectName
						json.version = '0.0.0'
						delete json.license
						return JSON.stringify(json, null, 2)
					},
				},
			],
		},
		{
			value: 'lite',
			link: 'https://github.com/tenianon/lithe-admin/archive/refs/heads/lite.zip',
			deleteFile: [
				'.deepsource.toml',
				'vercel.json',
				'LICENSE',
				'pnpm-lock.yaml',
			],
			modifyFile: [
				{
					path: 'package.json',
					handle: (text, args) => {
						const json = JSON.parse(text)
						json.name = args.projectName
						json.version = '0.0.0'
						delete json.license
						return JSON.stringify(json, null, 2)
					},
				},
			],
		},
	]

	const selectedTemplate = templateList.find(
		(t) => t.value === (template as TemplateOptionValue),
	)

	if (!selectedTemplate) throw new Error(language.templateLinkError)

	const spinner = prompts.spinner({
		indicator: 'timer',
	})

	// 3. download template
	await downdownZipPackage(selectedTemplate.link, outputDir, language, spinner)

	// 4. delete file
	const deletePromise = selectedTemplate.deleteFile
		? deleteFile(selectedTemplate.deleteFile, outputDir)
		: Promise.resolve()

	// 5. modify file
	const modifyPromise = selectedTemplate.modifyFile
		? Promise.all(
				selectedTemplate.modifyFile.map(({ path, handle }) =>
					modifyFile(
						path,
						(text) => handle(text, { projectName: finalProjectName }),
						outputDir,
					),
				),
			)
		: Promise.resolve()

	await Promise.all([deletePromise, modifyPromise])

	spinner.stop(chalk.hex('#7ccf00')(language.templateDownloadCompleted), 0)

	prompts.outro(
		`${language.outro}${projectName !== '.' ? `\n` : ''}
   ${chalk.hex('#ad46ff')(projectName !== '.' ? `cd ${projectName}` : '')}
   ${chalk.hex('#ad46ff')(`${getPackageManager()} install`)}
   ${chalk.hex('#ad46ff')(`${getPackageManager()} run dev`)}
  `,
	)
}

bootstrap()
