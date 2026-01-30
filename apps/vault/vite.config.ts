import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => ({
	// In test mode, use minimal svelte plugin for component tests
	// In dev/build mode, use full sveltekit with tailwind
	plugins: mode === 'test' 
		? [svelte({ hot: false })] 
		: [tailwindcss(), sveltekit()],
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
		pool: 'forks'
	}
}));
