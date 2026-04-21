import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const usePolling = process.env.HOST_OS === 'Windows_NT';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		strictPort: false,
		watch: usePolling ? { usePolling: true, interval: 100 } : undefined
	}
});
