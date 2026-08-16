export type WorkspaceExplorerNode = {
  name: string
  type: 'file' | 'folder'
  path: string
  target: string[]
  children?: WorkspaceExplorerNode[]
  content?: WorkspaceFilePreview
}

export type WorkspaceFilePreview =
  | {
      kind: 'folder'
      path: string
    }
  | {
      kind: 'text'
      path: string
      content: string
      truncated: boolean
    }
  | {
      kind: 'image'
      path: string
      fileUrl: string
    }
  | {
      kind: 'video'
      path: string
      fileUrl: string
    }
  | {
      kind: 'binary'
      path: string
      message: string
    }
  | {
      kind: 'missing'
      path: string
      message: string
    }

export type WorkspaceFileChangedEvent = {
  workspacePath: string
  event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
  path: string
  target: string[]
  parentTarget: string[]
  name: string
  type: 'file' | 'folder'
}
