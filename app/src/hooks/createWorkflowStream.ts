import {
  agentEventNames,
  plannerEventNames,
  askUserQuestionEventNames,
  workflowEventNames,
  type AgentLifecycleEvents,
  type PlannerEvents,
  type WorkflowEvents,
  type AskUserQuestionEvents,
} from '@/agent/core/event/channels'

type EventMapToUnion<T extends Record<string, (...args: any) => any>> = {
  [K in keyof T]: T[K] extends (data: infer D) => any ? { type: K; data: D } : never
}[keyof T]
export type WorkflowState =
  | EventMapToUnion<AgentLifecycleEvents>
  | EventMapToUnion<AskUserQuestionEvents>
  | EventMapToUnion<PlannerEvents>
  | EventMapToUnion<WorkflowEvents>

export function createWorkflowStream(abortSignal: AbortSignal) {
  let eventListeners: ReturnType<typeof window.ipcRendererApi.on>[] = []
  let currentSessionId: string | null = null
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
          cleanUp()
        })
      }

      agentEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (currentSessionId === data.sessionId) {
            controller.enqueue({ type: eventName, data })
          }

          if (eventName === 'agent-session-finished') {
            controller.close()
            cleanUp()
          }
        })
        eventListeners.push(remove)
      })

      plannerEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (currentSessionId === data.sessionId) {
            controller.enqueue({ type: eventName, data })
          }
        })
        eventListeners.push(remove)
      })

      askUserQuestionEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (currentSessionId === data.sessionId) {
            controller.enqueue({ type: eventName, data })
          }
        })
        eventListeners.push(remove)
      })

      workflowEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (eventName === 'workflow-start' && currentSessionId === null) {
            currentSessionId = data.ctx.sessionId
          }
          if (currentSessionId === data.ctx.sessionId) {
            controller.enqueue({ type: eventName, data })
          }

          if (eventName === 'workflow-error') {
            controller.close()
            cleanUp()
          }
        })
        eventListeners.push(remove)
      })
    },
    cancel() {
      // 清理所有监听器
      cleanUp()
    },
  })
  return stream
}
