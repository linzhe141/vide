import { FileClock, FolderTree, Image as ImageIcon, Search, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Session } from '@/store/sessionStore/types'
import { ImagePreviewPane } from './ImagePreviewPane'
import { SessionLogPane } from './SessionLogPane'
import { WebSearchDisplay } from './WebSearchDisplay'
import { WorkspaceExplorerPane } from './WorkspaceExplorer'

export type ChatPanelId = 'file-explorer' | 'web-search' | 'logs' | 'image-preview'

export type ChatPanelComponentProps = {
  session: Session | undefined
}

export type ChatPanelDefinition = {
  id: ChatPanelId
  title: string
  icon: LucideIcon
  showInToolbar: boolean
  defaultWidth: number
  minWidth: number
  maxWidth?: number
  Component: ComponentType<ChatPanelComponentProps>
}

function FileExplorerPanel({ session }: ChatPanelComponentProps) {
  return <WorkspaceExplorerPane workspacePath={session?.workspacePath} />
}

function WebSearchPanel() {
  return <WebSearchDisplay />
}

function LogsPanel() {
  return <SessionLogPane />
}

function ImagePreviewPanel() {
  return <ImagePreviewPane />
}

export const chatPanelDefinitions = [
  {
    id: 'logs',
    title: 'Session log',
    icon: FileClock,
    showInToolbar: true,
    defaultWidth: 680,
    minWidth: 460,
    maxWidth: 980,
    Component: LogsPanel,
  },
  {
    id: 'file-explorer',
    title: 'File explorer',
    icon: FolderTree,
    showInToolbar: true,
    defaultWidth: 960,
    minWidth: 620,
    maxWidth: 1600,
    Component: FileExplorerPanel,
  },
  {
    id: 'image-preview',
    title: 'Image preview',
    icon: ImageIcon,
    showInToolbar: false,
    defaultWidth: 720,
    minWidth: 420,
    maxWidth: 1320,
    Component: ImagePreviewPanel,
  },
  {
    id: 'web-search',
    title: 'Web search',
    icon: Search,
    showInToolbar: false,
    defaultWidth: 520,
    minWidth: 380,
    maxWidth: 760,
    Component: WebSearchPanel,
  },
] satisfies ChatPanelDefinition[]

export const defaultChatPanelId: ChatPanelId = 'file-explorer'
export const webSearchPanelId: ChatPanelId = 'web-search'
export const imagePreviewPanelId: ChatPanelId = 'image-preview'

export const toolbarChatPanelDefinitions = chatPanelDefinitions.filter(
  (panel) => panel.showInToolbar
)

export function getChatPanelDefinition(id: ChatPanelId) {
  return chatPanelDefinitions.find((panel) => panel.id === id) ?? null
}
