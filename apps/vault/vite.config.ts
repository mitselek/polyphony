import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => ({
	plugins: mode === 'test' ? [] : [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			'$lib': path.resolve(__dirname, './src/lib')
		}
	},
	test: {
		include: ['src/**/*.spec.ts'],
		environment: 'node',
		// Disable SSR transformation for tests
		pool: 'forks'
	}
}));
