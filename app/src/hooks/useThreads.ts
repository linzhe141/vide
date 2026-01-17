import { useState } from 'react'

export interface Thread {
  id: string
  title?: string
  updatedAt: number
}

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const createThread = async () => {
    const threadId = await window.ipcRendererApi.invoke('agent-create-session')

    const newThread: Thread = {
      id: threadId,
      updatedAt: Date.now(),
    }

    setThreads((prev) => [newThread, ...prev])
    setActiveThreadId(threadId)

    return threadId
  }

  return {
    threads,
    activeThreadId,

    createThread,
  }
}
