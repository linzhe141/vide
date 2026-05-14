import { createContext, useContext, type PropsWithChildren, useCallback, useMemo } from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { getNextBranchName, useThread, useThreadStoreActions } from '../../store/threadStore'
import type { ConversationBlock } from '../../store/threadStore'

interface ChatContextType {
  handleSend: (input: string) => Promise<void>
  handleFork: (targetBlockId: string | null, branchName?: string) => Promise<string>
  handleRegenerate: (block: ConversationBlock) => Promise<string>
  running: boolean
  threadId: string
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ threadId, children }: PropsWithChildren<{ threadId: string }>) {
  const { send, fork, forkAndSend, running } = useWorkflowStream()
  const thread = useThread(threadId)
  const { switchBranch } = useThreadStoreActions()

  const handleSend = useCallback(
    async (input: string) => {
      await send(input, {
        sessionId: threadId,
        branchName: thread?.activeBranch,
      })
    },
    [send, thread?.activeBranch, threadId]
  )

  const handleFork = useCallback(
    async (targetBlockId: string | null, branchName?: string) => {
      const nextBranchName = branchName || getNextBranchName(thread?.branches.map((item) => item.name) || [])
      await fork(threadId, targetBlockId, nextBranchName)
      switchBranch(threadId, nextBranchName)
      return nextBranchName
    },
    [fork, switchBranch, thread?.branches, threadId]
  )

  const handleRegenerate = useCallback(
    async (block: ConversationBlock) => {
      const nextBranchName = getNextBranchName(thread?.branches.map((item) => item.name) || [], 'regen')
      await forkAndSend({
        sessionId: threadId,
        targetBlockId: block.parentBlockId,
        branchName: nextBranchName,
        input: block.input,
      })
      switchBranch(threadId, nextBranchName)
      return nextBranchName
    },
    [forkAndSend, switchBranch, thread?.branches, threadId]
  )

  const value: ChatContextType = useMemo(
    () => ({
      running,
      handleSend,
      handleFork,
      handleRegenerate,
      threadId,
    }),
    [handleFork, handleRegenerate, handleSend, running, threadId]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}
