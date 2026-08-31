import { FileClock, FolderTree, Search, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { useSessionWorkspacePath } from '@/store/sessionStore'
import { SessionLogPane } from './SessionLogPane'
import { WebSearchDisplay } from './WebSearchDisplay'
import { WorkspaceExplorerPane } from './WorkspaceExplorer'

export type ChatPanelId = 'file-explorer' | 'web-search' | 'logs'

export type ChatPanelComponentProps = {
  sessionId: string
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

function FileExplorerPanel({ sessionId }: ChatPanelComponentProps) {
  const workspacePath = useSessionWorkspacePath(sessionId)
  return <WorkspaceExplorerPane workspacePath={workspacePath} />
}

function WebSearchPanel() {
  return <WebSearchDisplay />
}

function LogsPanel() {
  return <SessionLogPane />
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

export const toolbarChatPanelDefinitions = chatPanelDefinitions.filter(
  (panel) => panel.showInToolbar
)

export function getChatPanelDefinition(id: ChatPanelId) {
  return chatPanelDefinitions.find((panel) => panel.id === id) ?? null
}
