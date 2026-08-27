import { buildLocalAssetUrl } from '@vide/config'

export function getLocalAssetUrl(filePath: string) {
  return buildLocalAssetUrl(filePath)
}

export function getContainingDirectoryPath(filePath: string) {
  const separatorIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (separatorIndex === 2 && /^[A-Za-z]:[\\/]/.test(filePath)) {
    return filePath.slice(0, 3)
  }
  return separatorIndex > 0 ? filePath.slice(0, separatorIndex) : filePath
}

export function getPathName(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) ?? filePath
}
