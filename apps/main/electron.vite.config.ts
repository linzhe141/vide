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
      },
    },
    resolve: {
      alias: [
        { find: '@/agent', replacement: path.resolve(__dirname, '../../packages/agent/src') },
        { find: '@/app', replacement: path.resolve(__dirname, '../renderer') },
        { find: '@/electron', replacement: path.resolve(__dirname, './src') },
        { find: '@/main', replacement: path.resolve(__dirname, './src') },
        { find: '@', replacement: path.resolve(__dirname, '../..') },
      ],
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
    resolve: {
      alias: [
        { find: '@/agent', replacement: path.resolve(__dirname, '../../packages/agent/src') },
        { find: '@/app', replacement: path.resolve(__dirname, '../renderer') },
        { find: '@/electron', replacement: path.resolve(__dirname, './src') },
        { find: '@/main', replacement: path.resolve(__dirname, './src') },
        { find: '@', replacement: path.resolve(__dirname, '../..') },
      ],
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
      alias: [
        { find: '@/agent', replacement: path.resolve(__dirname, '../../packages/agent/src') },
        { find: '@/app', replacement: path.resolve(__dirname, '../renderer') },
        { find: '@/electron', replacement: path.resolve(__dirname, './src') },
        { find: '@/main', replacement: path.resolve(__dirname, './src') },
        { find: '@', replacement: path.resolve(__dirname, '../..') },
      ],
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
