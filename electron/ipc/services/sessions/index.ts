import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '@/electron/databaseManager'
import { artifacts, sessions } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import type { FileNode, SessionRowDto } from '../../api/channels'
import fs from 'fs/promises'
import path from 'path'
import { isBinaryFile } from 'isbinaryfile'

export class SessionIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('get-sessions-list', async () => {
      const rows = await db.select().from(sessions).orderBy(desc(sessions.createdAt))
      return rows as SessionRowDto[]
    })

    ipcMainApi.handle('get-session-artifacts', async ({ sessionId }) => {
      const ARTIFACT_ROOT = '.vide/artifacts'
      const rows = await db.select().from(artifacts).where(eq(artifacts.sessionId, sessionId))
      const trees: FileNode[] = []

      for (const { artifactWorkspaceName } of rows) {
        const targetDir = path.join(ARTIFACT_ROOT, artifactWorkspaceName)

        try {
          const tree = await buildFileTree(targetDir)
          trees.push(tree)
        } catch (_err) {
          console.warn('skip missing dir:', targetDir)
        }
      }
      return Promise.all(
        rows.map(async (i) => {
          const targetDir = path.join(ARTIFACT_ROOT, i.artifactWorkspaceName)
          const file = await buildFileTree(targetDir)
          return {
            ...i,
            file,
          }
        })
      )
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
