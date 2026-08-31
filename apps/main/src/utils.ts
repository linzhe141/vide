import { app } from 'electron'
import path from 'node:path'

export const IS_DEV = process.env.NODE_ENV === 'development'

export function resolveRuntimeResourcePath(...segments: string[]) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments)
  }

  return path.resolve(__dirname, '../../../resources', ...segments)
}
