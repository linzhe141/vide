import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '@/db/databaseManager'
import { artifacts, sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { FileNode, SessionRowDto } from '../../api/channels'
import fs from 'fs/promises'
import path from 'path'
import { isBinaryFile } from 'isbinaryfile'
import { getArtifactsRoot, scanSkills } from '@vide/agent'

export class SessionIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('get-sessions-list', async () => {
      return Array.from(this.appManager.agentManager.sessions).map(([sessionId, session]) => {
        return {
          id: sessionId,
          title: session.title,
          type: (session.sessionType as 'normal' | 'fork') ?? 'normal',
          originSessionId: null,
          originWorkflowId: null,
          workspacePath: session.workspacePath,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        } as SessionRowDto
      })
    })

    ipcMainApi.handle('get-session-artifacts', async ({ sessionId }) => {
      const sessionRows = await db.select().from(sessions).where(eq(sessions.id, sessionId))
      const workspacePath = sessionRows[0]?.workspacePath ?? null
      const artifactRoot = getArtifactsRoot(workspacePath)
      const rows = await db.select().from(artifacts).where(eq(artifacts.sessionId, sessionId))
      const result = []

      for (const item of rows) {
        const targetDir = path.join(artifactRoot, item.artifactWorkspaceName)
        try {
          const file = await buildFileTree(targetDir)
          result.push({
            ...item,
            file,
          })
        } catch (_err) {
          console.warn('skip missing dir:', targetDir)
        }
      }

      return result
    })

    ipcMainApi.handle('get-skills-list', async () => {
      return scanSkills()
    })
  }
}

async function buildFileTree(dir: string): Promise<FileNode> {
  const stat = await fs.stat(dir)

  const node: FileNode = {
    name: path.basename(dir),
    type: stat.isDirectory() ? 'folder' : 'file',
    path: path.resolve(dir),
  }
  if (node.type === 'file') {
    const isBinary = await isBinaryFile(node.path)
    if (!isBinary) node.content = await fs.readFile(node.path, 'utf-8')
  }
  if (stat.isDirectory()) {
    const entries = await fs.readdir(dir)

    node.children = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry)
        return buildFileTree(fullPath)
      })
    )
  }

  return node
}
