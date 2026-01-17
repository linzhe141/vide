import type { ChatMessage, ToolCall } from '@/agent/core/types'

export type WorkflowState =
  | { type: 'workflow-start'; data: { threadId: string; input: string } }
  | { type: 'workflow-finished'; data: { threadId: string } }
  // | { type: 'workflow-aborted'; data: { threadId: string } }
  | { type: 'workflow-wait-human-approve'; data: any }
  | { type: 'llm-start' }
  | { type: 'llm-delta'; data: { delta: string; content: string } }
  | { type: 'llm-tool-calls'; data: { toolCalls: ToolCall[] } }
  | { type: 'llm-end'; data: { finishReason: string } }
  | { type: 'llm-result'; data: { message: ChatMessage } }
  | { type: 'llm-error'; error: any }
  // | { type: 'llm-aborted' } // ui 不需要
  | { type: 'tool-call-start'; data: { id: string; toolName: string; args: any } }
  | { type: 'tool-call-success'; data: { id: string; toolName: string; result: any } }
  | { type: 'tool-call-error'; data: { id: string; toolName: string; error: any } }

export function createWorkflowStream(abortSignal: AbortSignal) {
  let eventListeners: ReturnType<typeof window.ipcRendererApi.on>[] = []

  function cleanUp() {
    eventListeners.forEach((remove) => remove())
    eventListeners = []
  }
  const stream = new ReadableStream({
    start(controller) {
      // 监听 abort 信号
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          window.ipcRendererApi.invoke('agent-workflow-abort')
          controller.close()
        })
      }

      const enqueue = controller.enqueue.bind(controller)

      // 绑定所有事件监听器
      eventListeners = [
        window.ipcRendererApi.on('agent-workflow-start', (data) => {
          const workflowChunk: WorkflowState = { type: 'workflow-start', data }
          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-workflow-finished', (data) => {
          const workflowChunk: WorkflowState = { type: 'workflow-finished', data }
          enqueue(workflowChunk)
          controller.close()
          cleanUp()
        }),

        window.ipcRendererApi.on('agent-workflow-wait-human-approve', (data) =>
          enqueue({ type: 'workflow-wait-human-approve', data })
        ),

        window.ipcRendererApi.on('agent-llm-start', () => {
          const workflowChunk: WorkflowState = { type: 'llm-start' }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-delta', (data) => {
          const workflowChunk: WorkflowState = { type: 'llm-delta', data }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-tool-calls', (data) => {
          const workflowChunk: WorkflowState = { type: 'llm-tool-calls', data }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-end', (finishReason) => {
          const workflowChunk: WorkflowState = { type: 'llm-end', data: { finishReason } }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-result', (message) => {
          const workflowChunk: WorkflowState = { type: 'llm-result', data: { message } }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-error', (error) => {
          const workflowChunk: WorkflowState = { type: 'llm-error', error }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-tool-call-start', (data) => {
          const workflowChunk: WorkflowState = { type: 'tool-call-start', data }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-tool-call-success', (data) => {
          const workflowChunk: WorkflowState = { type: 'tool-call-success', data }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-tool-call-error', (data) => {
          const workflowChunk: WorkflowState = { type: 'tool-call-error', data }

          enqueue(workflowChunk)
        }),
      ]
    },
    cancel() {
      // 清理所有监听器
      cleanUp()
    },
  })
  return stream
}
