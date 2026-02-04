import { useCallback, useRef, useState } from 'react'
import type { WorkflowState } from './createWorkflowStream'
import { createWorkflowStream } from './createWorkflowStream'
import { useThreadStore } from '../store/threadStore'
import type { AssistantChatMessage } from '@/agent/core/types'
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
  const {
    startNewBlock,
    finishCurrentBlock,
    pushMessageToCurrentBlock,
    updateLLMDeltaMessage,
    updateLLMResultMessage,
    updateToolResultMessage,
  } = useThreadStore()

  const [state, setState] = useState<WorkflowStreamState>(initialState)
  const deltaBufferRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<WorkflowState> | null>(null)

  const cleanup = () => {
    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null

    abortControllerRef.current = null
  }

  const _abort = useCallback(() => {
    if (!abortControllerRef.current) return

    abortControllerRef.current.abort()

    setState((prev) => ({
      ...prev,
      isRunning: false,
      isAborted: true,
    }))

    cleanup()
  }, [])

  const handleWorkflowChunk = useCallback(
    (chunk: WorkflowState) => {
      setState((prev) => ({ ...prev, workflowState: chunk.type }))

      switch (chunk.type) {
        case 'workflow-start': {
          // 开启新的 block
          startNewBlock({
            role: ThreadMessageRole.User,
            content: chunk.data.input,
          })
          emitWorkflowEvent('workflow-start')
          break
        }
        case 'llm-delta': {
          deltaBufferRef.current += chunk.data.delta

          if (deltaBufferRef.current.length >= BUFFER_SIZE) {
            updateLLMDeltaMessage({
              role: ThreadMessageRole.AssistantText,
              content: chunk.data.content,
            })

            deltaBufferRef.current = ''
          }
          emitWorkflowEvent('llm-delta')
          break
        }

        case 'llm-result': {
          updateLLMResultMessage(chunk.data.message as AssistantChatMessage)
          emitWorkflowEvent('llm-result')
          break
        }

        case 'tool-call-success': {
          updateToolResultMessage({
            role: 'tool',
            tool_call_id: chunk.data.id,
            content: JSON.stringify(chunk.data.result, null, 2),
          })
          emitWorkflowEvent('tool-call-success')
          break
        }

        case 'tool-call-error': {
          updateToolResultMessage({
            role: 'tool',
            tool_call_id: chunk.data.id,
            content: String(chunk.data.error),
          })
          emitWorkflowEvent('tool-call-error')
          break
        }

        case 'workflow-finished': {
          // 完成当前 block
          finishCurrentBlock()

          setState((prev) => ({
            ...prev,
            isRunning: false,
            isFinished: true,
          }))
          emitWorkflowEvent('workflow-finished')
          break
        }

        case 'workflow-error': {
          setState((prev) => ({
            ...prev,
            isRunning: false,
            isFinished: false,
            isError: true,
            errorInfo: chunk.data.error,
          }))

          pushMessageToCurrentBlock({
            role: ThreadMessageRole.Error,
            error: chunk.data.error,
          })

          // 即使出错也要结束当前 block
          finishCurrentBlock()
          emitWorkflowEvent('workflow-error')
          break
        }
      }
    },
    [
      startNewBlock,
      finishCurrentBlock,
      pushMessageToCurrentBlock,
      updateLLMDeltaMessage,
      updateLLMResultMessage,
      updateToolResultMessage,
    ]
  )

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
    },
    [handleWorkflowChunk]
  )

  return {
    send,
    ...state,
  }
}
