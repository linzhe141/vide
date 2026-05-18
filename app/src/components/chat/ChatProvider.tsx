import { createContext, useContext, type PropsWithChildren, useCallback, useMemo } from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { useSession, useSessionRunning, useSessionStoreActions } from '../../store/sessionStore'
import type { ConversationBlock } from '../../store/sessionStore/types'

interface ChatContextType {
  handleSend: (input: string) => Promise<void>
  handleFork: (targetBlockId: string | null, branchName?: string) => Promise<string>
  handleRegenerate: (block: ConversationBlock) => Promise<string>
  running: boolean
  sessionId: string
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ sessionId, children }: PropsWithChildren<{ sessionId: string }>) {
  const { send, fork, forkAndSend } = useWorkflowStream()
  const session = useSession(sessionId)
  const sessionRunning = useSessionRunning(sessionId) ?? false
  const { switchBranch } = useSessionStoreActions()

  const handleSend = useCallback(
    async (input: string) => {
      if (sessionRunning) return
      await send(input, {
        sessionId: sessionId,
        branchName: session?.activeBranch,
      })
    },
    [send, session?.activeBranch, sessionId, sessionRunning]
  )

  const handleFork = useCallback(
    async (targetBlockId: string | null, branchName?: string) => {
      const nextBranchName =
        branchName || getNextBranchName(session?.branches.map((item) => item.name) || [])
      await fork(sessionId, targetBlockId, nextBranchName)
      switchBranch(sessionId, nextBranchName)
      return nextBranchName
    },
    [fork, switchBranch, session?.branches, sessionId]
  )

  const handleRegenerate = useCallback(
    async (block: ConversationBlock) => {
      const nextBranchName = getNextBranchName(
        session?.branches.map((item) => item.name) || [],
        'regen'
      )
      await forkAndSend({
        sessionId: sessionId,
        targetBlockId: block.parentBlockId,
        branchName: nextBranchName,
        input: block.input,
      })
      switchBranch(sessionId, nextBranchName)
      return nextBranchName
    },
    [forkAndSend, switchBranch, session?.branches, sessionId]
  )

  const value: ChatContextType = useMemo(
    () => ({
      running: sessionRunning,
      handleSend,
      handleFork,
      handleRegenerate,
      sessionId,
    }),
    [handleFork, handleRegenerate, handleSend, sessionId, sessionRunning]
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
