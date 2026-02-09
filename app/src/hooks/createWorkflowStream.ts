import type { AssistantChatMessage, ToolCall } from '@/agent/core/types'

export type WorkflowState =
  | { type: 'workflow-start'; data: { threadId: string; input: string } }
  | { type: 'workflow-finished'; data: { threadId: string } }
  | { type: 'workflow-error'; data: { threadId: string; error: any } }
  // | { type: 'workflow-aborted'; data: { threadId: string } }
  | { type: 'workflow-wait-human-approve'; data: any }
  | { type: 'llm-start' }
  | { type: 'llm-reasoning-start' }
  | { type: 'llm-reasoning-delta'; data: { reasonContent: string } }
  | { type: 'llm-reasoning-end' }
  | { type: 'llm-text-delta'; data: { delta: string; content: string } }
  | { type: 'llm-tool-calls-start' }
  | { type: 'llm-tool-call-name'; data: { name: string; id: string } }
  | { type: 'llm-tool-call-arguments'; data: { arguments: string; id: string } }
  | { type: 'llm-tool-calls'; data: { toolCalls: ToolCall[] } }
  | { type: 'llm-end'; data: { finishReason: string } }
  | { type: 'llm-result'; data: { message: AssistantChatMessage } }
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

      const enqueue = (data: WorkflowState) => {
        controller.enqueue.call(controller, data)
      }

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

        window.ipcRendererApi.on('agent-workflow-error', (data) => {
          enqueue({ type: 'workflow-error', data })
          controller.close()
          cleanUp()
        }),

        window.ipcRendererApi.on('agent-llm-start', () => {
          const workflowChunk: WorkflowState = { type: 'llm-start' }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-reasoning-start', () => {
          const workflowChunk: WorkflowState = { type: 'llm-reasoning-start' }

          enqueue(workflowChunk)
        }),
        window.ipcRendererApi.on('agent-llm-reasoning-delta', (data) => {
          const workflowChunk: WorkflowState = { type: 'llm-reasoning-delta', data }

          enqueue(workflowChunk)
        }),
        window.ipcRendererApi.on('agent-llm-reasoning-end', () => {
          const workflowChunk: WorkflowState = { type: 'llm-reasoning-end' }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-tool-calls-start', () => {
          const workflowChunk: WorkflowState = { type: 'llm-tool-calls-start' }

          enqueue(workflowChunk)
        }),
        window.ipcRendererApi.on('agent-llm-tool-call-name', (data) => {
          const workflowChunk: WorkflowState = { type: 'llm-tool-call-name', data }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-tool-call-arguments', (data) => {
          const workflowChunk: WorkflowState = { type: 'llm-tool-call-arguments', data }

          enqueue(workflowChunk)
        }),

        window.ipcRendererApi.on('agent-llm-text-delta', (data) => {
          const workflowChunk: WorkflowState = { type: 'llm-text-delta', data }

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
