import { useRef, useState } from 'react'
import type { ChatMessage } from '@/agent/core/types'
import type { WorkflowState } from './createWorkflowStream'
import { createWorkflowStream } from './createWorkflowStream'

type UseWorkflowStreamState = {
  threadId?: string
  messages: ChatMessage[]
  workflowState: WorkflowState['type'] | null
  isRunning: boolean
  isFinished: boolean
  isAborted: boolean
}

const initialState: UseWorkflowStreamState = {
  threadId: undefined,
  messages: [],
  workflowState: null,
  isRunning: false,
  isFinished: false,
  isAborted: false,
}

export function useWorkflowStream() {
  const [state, setState] = useState<UseWorkflowStreamState>(initialState)

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

  const send = async (input: string) => {
    // 防止并发 send
    if (state.isRunning) {
      console.warn('[useWorkflowStream] workflow is already running')
      return
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const stream = createWorkflowStream(abortController.signal)
    const reader = stream.getReader()
    readerRef.current = reader

    if (state.messages.length === 0) {
      await window.ipcRendererApi.invoke('agent-create-session')
    }
    // 通知 main 开始 workflow
    await window.ipcRendererApi.invoke('agent-session-send', { input })

    setState({
      threadId: undefined,
      messages: [],
      workflowState: 'workflow-start',
      isRunning: true,
      isFinished: false,
      isAborted: false,
    })

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
      cleanup()
    }
  }
  const handleWorkflowChunk = (chunk: WorkflowState) => {
    setState((prev) => {
      switch (chunk.type) {
        case 'workflow-start':
          return {
            ...prev,
            threadId: chunk.data.threadId,
            workflowState: 'workflow-start',
          }

        case 'llm-start':
          return {
            ...prev,
            workflowState: 'llm-start',
          }

        case 'llm-delta':
          return {
            ...prev,
            workflowState: 'llm-delta',
            messages: mergeDelta(prev.messages, chunk.data),
          }

        // case 'llm-result':
        //   return {
        //     ...prev,
        //     workflowState: 'llm-result',
        //     messages: appendMessage(prev.messages, chunk.data.message),
        //   }

        case 'tool-call-start':
          return {
            ...prev,
            workflowState: 'tool-call-start',
          }

        case 'tool-call-success':
          return {
            ...prev,
            workflowState: 'tool-call-success',
          }

        case 'workflow-wait-human-approve':
          return {
            ...prev,
            workflowState: 'workflow-wait-human-approve',
          }

        case 'workflow-finished':
          return {
            ...prev,
            workflowState: 'workflow-finished',
            isRunning: false,
            isFinished: true,
          }

        case 'llm-error':
        case 'tool-call-error':
          return {
            ...prev,
            workflowState: chunk.type,
            isRunning: false,
          }

        default:
          return prev
      }
    })
  }
  return {
    send,
    abort,

    threadId: state.threadId,
    messages: state.messages,
    workflowState: state.workflowState,

    isRunning: state.isRunning,
    isFinished: state.isFinished,
    isAborted: state.isAborted,
  }
}

/**
 * 把 llm-delta 合并进最后一条 assistant message
 */
function mergeDelta(
  messages: ChatMessage[],
  data: { delta: string; content: string }
): ChatMessage[] {
  const last = messages[messages.length - 1]

  if (!last || last.role !== 'assistant') {
    return [
      ...messages,
      {
        role: 'assistant',
        content: data.delta,
      },
    ]
  }

  const next = [...messages]
  next[next.length - 1] = {
    ...last,
    content: last.content + data.delta,
  }

  return next
}

// function appendMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
//   return [...messages, message]
// }
