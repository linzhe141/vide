import { useCallback, useRef } from 'react'

import { createWorkflowStream } from './createWorkflowStream'
import { useThreadStore } from '../store/threadStore'
import type { WorkflowState } from './createWorkflowStream'

type WorkflowListenersType = { [k in WorkflowState['type']]: Array<(...args: any[]) => any> }
const workflowListeners = {} as WorkflowListenersType
export function onWorkflowEvent(event: WorkflowState['type'], fn: (...args: any[]) => any) {
  if (!workflowListeners[event]) {
    workflowListeners[event] = []
  }
  workflowListeners[event].push(fn)
  return () => {
    workflowListeners[event] = workflowListeners[event].filter((i) => i !== fn)
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

  const handleEvent = useThreadStore((s) => s.handleEvent)

  const cleanup = () => {
    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null
    abortControllerRef.current = null
  }

  const send = useCallback(
    async (input: string) => {
      const abortController = new AbortController()

      abortControllerRef.current = abortController

      const stream = createWorkflowStream(abortController.signal)

      const reader = stream.getReader()

      readerRef.current = reader

      await window.ipcRendererApi.invoke('agent-session-send', { input })
      try {
        while (true) {
          const { value, done } = await reader.read()

          if (done) break
          if (!value) continue

          handleEvent(value)
        }
        console.log('abcd 1')
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(err)
        }
      } finally {
        console.log('abcd 2')

        reader.releaseLock()
        cleanup()
      }
    },
    [handleEvent]
  )

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
    cleanup()
  }, [])

  return {
    send,
    abort,
  }
}
