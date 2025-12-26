export function getPackageManager(): 'pnpm' | 'yarn' | 'npm' | 'bun'{
	const ua = process.env.npm_config_user_agent ?? ''
	if (ua.startsWith('pnpm')) return 'pnpm'
	if (ua.startsWith('yarn')) return 'yarn'
	if (ua.startsWith('bun')) return 'bun'
	return 'npm'
}
