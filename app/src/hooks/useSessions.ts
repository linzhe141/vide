import { useState } from 'react'

export interface Session {
  id: string
  title?: string
  updatedAt: number
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const createSession = async () => {
    const sessionId = await window.ipcRendererApi.invoke('agent-create-session')

    const newSession: Session = {
      id: sessionId,
      updatedAt: Date.now(),
    }

    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(sessionId)

    return sessionId
  }

  return {
    sessions,
    activeSessionId,

    createSession,
  }
}
