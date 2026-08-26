import path from 'node:path'
import { fileURLToPath } from 'node:url'

import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const rendererRoot = path.resolve(appRoot, '../renderer/src')
const rendererPort = 1412

export default defineConfig(async () => ({
  base: './',
  root: rendererRoot,
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: path.resolve(appRoot, 'dist/app'),
    rollupOptions: {
      input: {
        main: path.resolve(rendererRoot, 'index.html'),
      },
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
    sourcemap: true,
    target: 'esnext',
  },
  resolve: {
    alias: [{ find: '@', replacement: rendererRoot }],
  },
  plugins: [
    react(),
    await babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    port: rendererPort,
    strictPort: true,
  },
}))
