import { app } from 'electron'
import path from 'node:path'
import { IS_DEV } from './utils'

if (IS_DEV) {
  const devUserDataPath = path.join(app.getPath('appData'), `${app.getName()}-dev`)
  app.setPath('userData', devUserDataPath)
}
