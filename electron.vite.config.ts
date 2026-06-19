import { defineConfig } from 'electron-vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/electron/main',
      sourcemap: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, './apps/main/main.ts'),
        },
      },
    },
    resolve: {
      alias: [
        { find: '@/agent', replacement: path.resolve(__dirname, './packages/agent') },
        { find: '@/app', replacement: path.resolve(__dirname, './apps/renderer') },
        { find: '@/electron', replacement: path.resolve(__dirname, './apps/main') },
        { find: '@/main', replacement: path.resolve(__dirname, './apps/main') },
        { find: '@', replacement: path.resolve(__dirname, '.') },
      ],
    },
  },
  preload: {
    build: {
      outDir: 'dist/electron/preload',
      sourcemap: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, './apps/main/preload/index.ts'),
        },
      },
    },
    resolve: {
      alias: [
        { find: '@/agent', replacement: path.resolve(__dirname, './packages/agent') },
        { find: '@/app', replacement: path.resolve(__dirname, './apps/renderer') },
        { find: '@/electron', replacement: path.resolve(__dirname, './apps/main') },
        { find: '@/main', replacement: path.resolve(__dirname, './apps/main') },
        { find: '@', replacement: path.resolve(__dirname, '.') },
      ],
    },
  },
  renderer: {
    root: './apps/renderer',
    build: {
      target: 'esnext',
      outDir: 'dist/app',
      rollupOptions: {
        input: {
          main: './index.html',
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
        { find: '@/agent', replacement: path.resolve(__dirname, './packages/agent') },
        { find: '@/app', replacement: path.resolve(__dirname, './apps/renderer') },
        { find: '@/electron', replacement: path.resolve(__dirname, './apps/main') },
        { find: '@/main', replacement: path.resolve(__dirname, './apps/main') },
        { find: '@', replacement: path.resolve(__dirname, '.') },
      ],
    },
    plugins: [
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      tailwindcss(),
    ],
    server: {
      port: 1412,
    },
  },
})
