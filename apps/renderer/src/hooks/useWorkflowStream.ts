import { useCallback, useRef, useState } from 'react'
import { createWorkflowStream, resumeWorkflowStream } from './createWorkflowStream'
import { useSessionStoreActions } from '../store/sessionStore'

export function useWorkflowStream() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const [running, setRunning] = useState(false)
  const { handleEvent } = useSessionStoreActions()

  const cleanup = () => {
    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null
    abortControllerRef.current = null
  }

  const send = useCallback(
    async (sessionId: string, input: string) => {
      setRunning(true)
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const stream = createWorkflowStream(abortController.signal)
      const reader = stream.getReader()
      readerRef.current = reader

      try {
        window.ipcRendererApi.invoke('agent-session-send', {
          sessionId,
          input,
        })
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (!value) continue
          handleEvent(value)
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(err)
        }
      } finally {
        setRunning(false)
        reader.releaseLock()
        cleanup()
      }
    },
    [handleEvent]
  )

  const resumeRunningWorkflow = useCallback(
    async (sessionId: string, workflowId: string) => {
      setRunning(true)
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const stream = resumeWorkflowStream(sessionId, workflowId, abortController.signal)
      const reader = stream.getReader()
      readerRef.current = reader

      try {
        window.ipcRendererApi.invoke('resume-running-workflow', {
          sessionId,
          workflowId,
        })
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (!value) continue
          handleEvent(value)
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(err)
        }
      } finally {
        setRunning(false)
        reader.releaseLock()
        cleanup()
      }
    },
    [handleEvent]
  )

  const abort = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    send,
    abort,
    resumeRunningWorkflow,
    running,
  }
}
