export function getPackageManager(): 'pnpm' | 'yarn' | 'npm' {
	const ua = process.env.npm_config_user_agent ?? ''
	if (ua.startsWith('pnpm')) return 'pnpm'
	if (ua.startsWith('yarn')) return 'yarn'
	return 'npm'
}
