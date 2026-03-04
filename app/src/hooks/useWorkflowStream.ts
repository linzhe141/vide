import { useCallback, useRef, useState } from 'react'
import type { WorkflowState } from './createWorkflowStream'
import { createWorkflowStream } from './createWorkflowStream'
import { useThreadStore } from '../store/threadStore'
import { ThreadMessageRole } from '@/types'

type WorkflowStreamState = {
  workflowState: WorkflowState['type']

  isRunning: boolean
  isFinished: boolean
  isAborted: boolean
  isError: boolean
  errorInfo: any
}

const initialState: WorkflowStreamState = {
  workflowState: 'workflow-finished',
  isRunning: false,
  isFinished: false,
  isAborted: false,
  isError: false,
  errorInfo: null,
}

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
function emitWorkflowEvent(event: WorkflowState['type'], ...args: any[]) {
  const listeners = workflowListeners[event]
  if (listeners) {
    listeners.forEach((fn) => fn(...args))
  }
}

// 减少stream re-render 频次
const BUFFER_SIZE = 10
export function useWorkflowStream() {
  const [state, setState] = useState<WorkflowStreamState>(initialState)
  const deltaBufferRef = useRef<string>('')
  const contentBufferRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<WorkflowState> | null>(null)

  const cleanup = () => {
    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null

    abortControllerRef.current = null
  }

  const abort = useCallback(() => {
    if (!abortControllerRef.current) return

    abortControllerRef.current.abort()

    setState((prev) => ({
      ...prev,
      isRunning: false,
      isAborted: true,
    }))

    cleanup()
  }, [])

  const handleWorkflowChunk = useCallback((chunk: WorkflowState) => {
    setState((prev) => ({ ...prev, workflowState: chunk.type }))
    console.log(chunk)
  }, [])

  const send = useCallback(
    async (input: string) => {
      // 防止并发 send

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const stream = createWorkflowStream(abortController.signal)
      const reader = stream.getReader()
      readerRef.current = reader

      // 通知 main 开始 workflow
      await window.ipcRendererApi.invoke('agent-session-send', { input })

      setState((prev) => ({ ...prev, isRunning: true }))
      window.chunkArray = []
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (!value) continue
          window.chunkArray.push(value)
          handleWorkflowChunk(value)
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // 正常中断
          return
        }

        console.error('[useWorkflowStream] stream error', err)
      } finally {
        reader.releaseLock()
        cleanup()
      }
    },
    [handleWorkflowChunk]
  )

  const restore = useCallback(async () => {
    // 防止并发 send

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const stream = createWorkflowStream(abortController.signal)
    const reader = stream.getReader()
    readerRef.current = reader

    setState((prev) => ({ ...prev, isRunning: true }))

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue

        handleWorkflowChunk(value)
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // 正常中断
        return
      }

      console.error('[useWorkflowStream] stream error', err)
    } finally {
      reader.releaseLock()
      cleanup()
    }
  }, [handleWorkflowChunk])

  return {
    send,
    abort,
    restore,
    ...state,
  }
}
