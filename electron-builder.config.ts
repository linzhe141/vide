import type { Configuration } from 'electron-builder'

export default {
  appId: 'me.vide',
  productName: 'vide',

  directories: {
    buildResources: 'resources',
    output: 'dist/electron-pack',
  },

  files: [
    'dist/app/**/*',
    'dist/electron/**/*',
    'apps/main/drizzle/**/*',
    'package.json',
    'resources/**',
  ],
  asar: true,
  asarUnpack: ['node_modules/**'],
  publish: [
    {
      provider: 'github',
      owner: 'linzhe141',
      repo: 'vide',
    },
  ],

  protocols: [
    {
      name: 'vide',
      schemes: ['vide'],
    },
  ],

  win: {
    icon: 'resources/logo.ico',
    target: ['nsis'],
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
  },
  mac: {
    target: 'dmg',
  },
  linux: {
    target: 'AppImage',
  },
} satisfies Configuration
