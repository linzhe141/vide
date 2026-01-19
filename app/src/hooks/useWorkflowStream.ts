import { useCallback, useRef, useState } from 'react'
import type { AssistantChatMessage } from '@/agent/core/types'
import type { WorkflowState } from './createWorkflowStream'
import { createWorkflowStream } from './createWorkflowStream'
import { useThreadStore } from '../store/threadStore'

type WorkflowStreamState = {
  workflowState: WorkflowState['type']

  isRunning: boolean
  isFinished: boolean
  isAborted: boolean
}

const initialState: WorkflowStreamState = {
  workflowState: 'workflow-finished',
  isRunning: false,
  isFinished: false,
  isAborted: false,
}

export function useWorkflowStream() {
  const { pushMessage, updateLLMDeltaMessage, updateLLMResultMessage } = useThreadStore()
  const [state, setState] = useState<WorkflowStreamState>(initialState)

  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<WorkflowState> | null>(null)

  const cleanup = () => {
    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null

    abortControllerRef.current = null
  }

  const abort = () => {
    if (!abortControllerRef.current) return

    abortControllerRef.current.abort()

    setState((prev) => ({
      ...prev,
      isRunning: false,
      isAborted: true,
    }))

    cleanup()
  }

  const handleWorkflowChunk = useCallback(
    (chunk: WorkflowState) => {
      setState((prev) => ({ ...prev, workflowState: chunk.type }))

      switch (chunk.type) {
        case 'workflow-start': {
          pushMessage({
            role: 'user',
            content: chunk.data.input,
          })
          break
        }
        case 'llm-delta': {
          updateLLMDeltaMessage({
            role: 'assistant',
            content: chunk.data.content,
          })
          break
        }

        case 'llm-result': {
          updateLLMResultMessage(chunk.data.message as AssistantChatMessage)
          break
        }

        case 'tool-call-success': {
          pushMessage({
            role: 'tool',
            tool_call_id: chunk.data.id,
            content: JSON.stringify(chunk.data.result, null, 2),
          })
          break
        }

        case 'tool-call-error': {
          pushMessage({
            role: 'tool',
            tool_call_id: chunk.data.id,
            content: String(chunk.data.error),
          })
          break
        }

        case 'workflow-finished': {
          setState((prev) => ({
            ...prev,
            isRunning: false,
            isFinished: true,
          }))
          break
        }
      }
    },
    [pushMessage, updateLLMDeltaMessage, updateLLMResultMessage]
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
    abort,

    workflowState: state.workflowState,

    isRunning: state.isRunning,
    isFinished: state.workflowState === 'workflow-finished',
    isAborted: state.isAborted,
  }
}
