import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), TanStackRouterVite()],
    server: {
        host: '0.0.0.0',
        port: 5173,
        watch: {
            usePolling: true,
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
