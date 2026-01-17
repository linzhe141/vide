import { useCallback, useRef, useState } from 'react'
import type { AssistantChatMessage, ChatMessage, ToolCall } from '@/agent/core/types'
import type { WorkflowState } from './createWorkflowStream'
import { createWorkflowStream } from './createWorkflowStream'

type UseWorkflowStreamState = {
  threadId: string
  messages: ChatMessage[]
  workflowState: WorkflowState['type']

  isRunning: boolean
  isFinished: boolean
  isAborted: boolean
}

const initialState: UseWorkflowStreamState = {
  threadId: undefined!,
  messages: [],
  workflowState: 'workflow-finished',
  isRunning: false,
  isFinished: false,
  isAborted: false,
}

export function useWorkflowStream(threadId: string) {
  const [state, setState] = useState<UseWorkflowStreamState>({ ...initialState, threadId })

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

  const send = useCallback(async (input: string) => {
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
  }, [])
  const handleWorkflowChunk = (chunk: WorkflowState) => {
    setState((prev: UseWorkflowStreamState): UseWorkflowStreamState => {
      switch (chunk.type) {
        case 'workflow-start': {
          const userMessage: ChatMessage = {
            role: 'user',
            content: chunk.data.input,
          }
          return {
            ...prev,
            threadId: chunk.data.threadId,
            messages: [...prev.messages, userMessage],
            workflowState: 'workflow-start',
          }
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
            messages: updateLLMDelta(prev.messages, chunk.data),
          }

        case 'llm-end':
          return {
            ...prev,
            workflowState: 'llm-end',
          }

        case 'llm-result': {
          const last = prev.messages[prev.messages.length - 1] as AssistantChatMessage
          if (last.role === 'assistant') {
            const finishedMessages = prev.messages.slice(0, prev.messages.length - 1)
            let toolCalls: ToolCall[] = []
            if ('tool_calls' in chunk.data.message) {
              // @ts-expect-error todo
              toolCalls = chunk.data.message.tool_calls!
            }
            const newLast = { ...last }
            if (toolCalls.length) {
              newLast.tool_calls = toolCalls
            }
            return {
              ...prev,
              workflowState: 'llm-result',
              messages: [...finishedMessages, newLast],
            }
          } else {
            return {
              ...prev,
              workflowState: 'llm-result',
              messages: [...prev.messages, chunk.data.message],
            }
          }
        }

        case 'llm-error':
          return {
            ...prev,
            workflowState: 'llm-error',
          }

        case 'tool-call-start':
          return {
            ...prev,
            workflowState: 'tool-call-start',
          }

        case 'tool-call-success': {
          const toolCallResult = chunk.data.result
          const toolCallId = chunk.data.id
          return {
            ...prev,
            workflowState: 'tool-call-success',
            messages: [
              ...prev.messages,
              {
                role: 'tool',
                tool_call_id: toolCallId,
                content: JSON.stringify(toolCallResult, null, 2),
              },
            ],
          }
        }

        case 'tool-call-error': {
          const toolCallError = chunk.data.error
          const toolCallId = chunk.data.id
          return {
            ...prev,
            workflowState: 'tool-call-success',
            messages: [
              ...prev.messages,
              {
                role: 'tool',
                tool_call_id: toolCallId,
                content: String(toolCallError),
              },
            ],
          }
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

        default:
          return prev
      }
    })
  }
  return {
    send,
    abort,

    messages: state.messages,
    workflowState: state.workflowState,

    isRunning: state.isRunning,
    isFinished: state.workflowState === 'workflow-finished',
    isAborted: state.isAborted,
  }
}

function updateLLMDelta(
  messages: ChatMessage[],
  data: { delta: string; content: string }
): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last.role !== 'assistant') {
    return [...messages, { role: 'assistant', content: data.content }]
  } else {
    const prev = messages.slice(0, messages.length - 1)
    const needUpdatedMessage = last as AssistantChatMessage
    return [
      ...prev,
      {
        ...needUpdatedMessage,
        content: data.content,
      },
    ]
  }
}
