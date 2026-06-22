import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/event/channels.ts', './src/types.ts'],
  dts: true,
  sourcemap: true,
})
