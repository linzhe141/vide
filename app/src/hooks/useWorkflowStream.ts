import { useCallback, useRef, useState } from 'react'
import { createWorkflowStream } from './createWorkflowStream'
import { useSessionStoreActions } from '../store/sessionStore'
import type { WorkflowState } from './createWorkflowStream'

type WorkflowListenersType = { [K in WorkflowState['type']]: Array<(...args: any[]) => any> }
const workflowListeners = {} as WorkflowListenersType

export function onWorkflowEvent(event: WorkflowState['type'], fn: (...args: any[]) => any) {
  if (!workflowListeners[event]) {
    workflowListeners[event] = []
  }
  workflowListeners[event].push(fn)
  return () => {
    workflowListeners[event] = workflowListeners[event].filter((item) => item !== fn)
  }
}

export function emitWorkflowEvent(event: WorkflowState['type'], ...args: any[]) {
  const listeners = workflowListeners[event]
  if (listeners) {
    listeners.forEach((fn) => fn(...args))
  }
}

export function useWorkflowStream() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<WorkflowState> | null>(null)
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
        await window.ipcRendererApi.invoke('agent-session-send', {
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

  const abort = useCallback(async ({ sessionId }: { sessionId: string }) => {
    await window.ipcRendererApi.invoke('agent-workflow-abort', { sessionId })
  }, [])

  return {
    send,
    abort,
    running,
  }
}
