import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Configuration } from 'electron-builder'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const runtimeExternalModules = Object.keys(
  (
    JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
  ).dependencies ?? {}
)

export default {
  appId: 'me.vide',
  productName: 'vide',
  icon: './resources/logo.png',

  directories: {
    buildResources: './resources',
    output: './dist/electron-pack',
  },

  files: [
    './dist/app/**/*',
    './dist/electron/**/*',
    './src/drizzle/**/*',
    '!**/*.map',
    'resources',
    '!**/*.tsbuildinfo',
  ],

  asar: {
    smartUnpack: false,
  },
  electronLanguages: ['en', 'en_GB', 'en_US', 'en-GB', 'en-US'],
  asarUnpack: runtimeExternalModules.map((moduleName) => `node_modules/${moduleName}/**/*`),
  publish: [
    {
      provider: 'github',
      owner: 'linzhe141',
      repo: 'vide',
      vPrefixedTagName: true,
      releaseType: 'release',
    },
  ],

  protocols: [
    {
      name: 'vide',
      schemes: ['vide'],
    },
  ],

  win: {
    icon: './resources/logo.png',
    target: ['nsis'],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
  },
  mac: {
    icon: './resources/logo.png',
    target: 'dmg',
  },
} satisfies Configuration
