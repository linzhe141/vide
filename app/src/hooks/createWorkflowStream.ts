import {
  agentEventNames,
  plannerEventNames,
  workflowEventNames,
  type AgentLifecycleEvents,
  type PlannerEvents,
  type WorkflowEvents,
} from '@/agent/core/event/channels'

type EventMapToUnion<T extends Record<string, (...args: any) => any>> = {
  [K in keyof T]: T[K] extends (data: infer D) => any ? { type: K; data: D } : never
}[keyof T]
export type WorkflowState =
  | EventMapToUnion<AgentLifecycleEvents>
  | EventMapToUnion<PlannerEvents>
  | EventMapToUnion<WorkflowEvents>

export function createWorkflowStream(
  abortSignal: AbortSignal,
  options?: {
    sessionId?: string
    closeOn?: WorkflowState['type'][]
  }
) {
  let eventListeners: ReturnType<typeof window.ipcRendererApi.on>[] = []
  let currentSessionId: string | null = options?.sessionId || null
  const closeOn = new Set<WorkflowState['type']>(options?.closeOn || [])
  function cleanUp() {
    eventListeners.forEach((remove) => remove())
    eventListeners = []
  }
  const stream = new ReadableStream({
    start(controller) {
      // 监听 abort 信号
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          if (currentSessionId) {
            window.ipcRendererApi.invoke('agent-workflow-abort', { sessionId: currentSessionId })
          }
          controller.close()
          cleanUp()
        })
      }

      agentEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (currentSessionId === data.sessionId) {
            controller.enqueue({ type: eventName, data })
          }

          if (
            currentSessionId === data.sessionId &&
            (eventName === 'agent-session-finished' || closeOn.has(eventName))
          ) {
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

      workflowEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (eventName === 'workflow-start' && currentSessionId === null) {
            currentSessionId = data.ctx.sessionId
          }
          if (currentSessionId === data.ctx.sessionId) {
            controller.enqueue({ type: eventName, data })
          }

          if (
            currentSessionId === data.ctx.sessionId &&
            (eventName === 'workflow-error' ||
              eventName === 'workflow-aborted' ||
              closeOn.has(eventName))
          ) {
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
