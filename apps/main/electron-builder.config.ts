import type { Configuration } from 'electron-builder'

export default {
  appId: 'me.vide',
  productName: 'vide',
  icon: '../../resources/logo.png',

  directories: {
    buildResources: '../../resources',
    output: './dist/electron-pack',
  },

  files: [
    './dist/app/**/*',
    './dist/electron/**/*',
    './src/drizzle/**/*',
    '../../package.json',
    '../../resources/**',
  ],
  asar: true,
  asarUnpack: ['node_modules/**'],
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
    icon: '../../resources/logo.png',
    target: ['nsis'],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
  },
  mac: {
    icon: '../../resources/logo.png',
    target: 'dmg',
  },
} satisfies Configuration
