import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(desktopRoot, 'package.json'))
const rendererPort = 1412
const pollIntervalMs = 200
const initialBuildTimeoutMs = 120_000
const children = []
let shuttingDown = false
let poll = null

const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')
const electronBin = require('electron')

const checkPort = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
  })

// Forward everything after `pnpm dev --` (e.g. --remote-debugging-port=9223) to electron.
const rawArgs = process.argv.slice(2)
const electronArgs = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs

function spawnChild(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: desktopRoot,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: 'inherit',
  })

  children.push(child)
  child.on('error', (error) => {
    console.error(error)
    shutdown(1)
  })

  return child
}

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(poll)

  for (const child of children) {
    child.kill()
  }

  process.exit(code)
}

function start() {
  const rendererConfig = path.resolve(desktopRoot, '../renderer/vite.config.ts')
  const renderer = spawnChild(process.execPath, [viteBin, '--config', rendererConfig])

  const mainBuilder = spawnChild(process.execPath, [
    viteBin,
    'build',
    '--watch',
    '--mode',
    'development',
    '--config',
    'vite.main.config.ts',
  ])
  const preloadBuilder = spawnChild(process.execPath, [
    viteBin,
    'build',
    '--watch',
    '--mode',
    'development',
    '--config',
    'vite.preload.config.ts',
  ])

  for (const child of [renderer, mainBuilder, preloadBuilder]) {
    child.on('exit', (code) => {
      if (!shuttingDown) shutdown(code ?? 1)
    })
  }

  const started = Date.now()
  let checking = false

  poll = setInterval(async () => {
    if (checking) return
    checking = true

    try {
      if (Date.now() - started > initialBuildTimeoutMs) {
        console.error(
          `[desktop-dev] initial build did not produce bundles within ${Math.round(initialBuildTimeoutMs / 1000)}s`
        )
        shutdown(1)
        return
      }

      if (!(await checkPort(rendererPort))) return

      clearInterval(poll)
      poll = null

      console.log('[desktop-dev] starting electron')
      // 改成 . 会影响 schema
      const electron = spawnChild(electronBin, [desktopRoot, ...electronArgs], {
        ELECTRON_RENDERER_URL: `http://127.0.0.1:${rendererPort}`,
        NODE_ENV: 'development',
      })

      electron.on('exit', (code) => {
        if (!shuttingDown) shutdown(code ?? 0)
      })
    } finally {
      checking = false
    }
  }, pollIntervalMs)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start()
