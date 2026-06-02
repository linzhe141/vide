import os from 'node:os'
import path from 'node:path'

export type WorkspacePath = string | null | undefined

export const DEFAULT_VIDE_HOME = path.join(os.homedir(), '.vide')

export function getVideHome(workspacePath?: WorkspacePath) {
  return workspacePath ? path.join(workspacePath, '.vide') : DEFAULT_VIDE_HOME
}

export function getArtifactsRoot(workspacePath?: WorkspacePath) {
  return path.join(getVideHome(workspacePath), 'artifacts')
}

export function getSkillsRoot() {
  return path.join(DEFAULT_VIDE_HOME, 'skills')
}

export function resolveWorkspacePath(workspacePath: WorkspacePath, inputPath: string) {
  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath)
  }
  return path.resolve(workspacePath || DEFAULT_VIDE_HOME, inputPath)
}
