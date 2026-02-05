import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import path from 'path';

export default defineConfig(({ mode }) => ({
	// In test mode, use minimal svelte plugin for component tests
	// In dev/build mode, use full sveltekit with tailwind and paraglide
	plugins: mode === 'test' 
		? [svelte({ hot: false })] 
		: [
				tailwindcss(),
				sveltekit(),
				paraglideVitePlugin({
					project: './project.inlang',
					outdir: './src/lib/paraglide',
					strategy: ['cookie', 'baseLocale'],  // Cookie-based, not URL-based
					disableAsyncLocalStorage: true  // CRITICAL for Cloudflare Workers
				})
			],
	resolve: {
		alias: {
			'$lib': path.resolve(__dirname, './src/lib')
		},
		// Force client-side Svelte in test environment
		conditions: mode === 'test' ? ['browser'] : undefined
	},
	test: {
		include: ['src/**/*.spec.ts'],
		// Default to node for fast unit tests
		// Component tests use @vitest-environment comment or file pattern
		environment: 'node',
		pool: 'forks',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json'],
			reportsDirectory: './coverage',
			include: ['src/lib/**/*.ts'],
			exclude: [
				'src/**/*.spec.ts',
				'src/**/*.d.ts',
				'src/lib/types.ts'
			]
		}
	}
}));
