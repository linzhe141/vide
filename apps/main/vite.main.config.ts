import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const builtinExternals = new Set(builtinModules.flatMap((id) => [id, `node:${id}`]))
const runtimeExternalModules = Object.keys(
  (
    JSON.parse(readFileSync(path.resolve(appRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
  ).dependencies ?? {}
)

const isRuntimeExternalModule = (id: string) =>
  runtimeExternalModules.some((moduleName) => id === moduleName || id.startsWith(`${moduleName}/`))

const external = (id: string) =>
  builtinExternals.has(id) || id === 'electron' || isRuntimeExternalModule(id)

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: path.resolve(appRoot, 'dist/electron/main'),
    rollupOptions: {
      external,
      input: {
        index: path.resolve(appRoot, 'src/main.ts'),
      },
      output: {
        chunkFileNames: '[name]-[hash].js',
        entryFileNames: 'index.js',
        format: 'cjs',
      },
    },
    sourcemap: true,
    ssr: path.resolve(appRoot, 'src/main.ts'),
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
