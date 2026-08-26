import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const builtinExternals = new Set(builtinModules.flatMap((id) => [id, `node:${id}`]))

const external = (id: string) => builtinExternals.has(id) || id === 'electron'

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: path.resolve(appRoot, 'dist/electron/preload'),
    rollupOptions: {
      external,
      input: {
        index: path.resolve(appRoot, 'src/preload/index.ts'),
      },
      output: {
        entryFileNames: 'index.js',
        format: 'cjs',
      },
    },
    sourcemap: true,
    ssr: path.resolve(appRoot, 'src/preload/index.ts'),
    ssrEmitAssets: true,
    target: 'es2022',
  },
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(appRoot, 'src') }],
  },
  ssr: {
    noExternal: true,
  },
})
