import { defineConfig } from 'electron-vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      outDir: './dist/electron/main',
      sourcemap: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, './src/main.ts'),
        },
        external: ['jsdom' /*,  '@mozilla/readability' */],
      },
    },
    resolve: {
      alias: [{ find: '@', replacement: path.resolve(__dirname, './src') }],
    },
  },
  preload: {
    build: {
      outDir: './dist/electron/preload',
      sourcemap: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, './src/preload/index.ts'),
        },
      },
    },
  },
  renderer: {
    root: path.resolve(__dirname, '../renderer/src'),
    build: {
      target: 'esnext',
      outDir: './dist/app',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, '../renderer/src/index.html'),
        },
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) return 'vendor'
          },
        },
      },
    },
    resolve: {
      alias: [{ find: '@', replacement: path.resolve(__dirname, '../../apps/renderer/src') }],
    },
    plugins: [
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      } as any),
      tailwindcss(),
    ],
    server: {
      port: 1412,
    },
  },
})
