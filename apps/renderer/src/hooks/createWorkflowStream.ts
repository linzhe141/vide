import {
  agentEventNames,
  plannerEventNames,
  workflowEventNames,
  type AgentLifecycleEvents,
  type PlannerEvents,
  type WorkflowEvents,
} from '@vide/agent/event'

type EventMapToUnion<T extends Record<string, (...args: any) => any>> = {
  [K in keyof T]: T[K] extends (data: infer D) => any ? { type: K; data: D } : never
}[keyof T]
export type WorkflowState =
  | EventMapToUnion<AgentLifecycleEvents>
  | EventMapToUnion<PlannerEvents>
  | EventMapToUnion<WorkflowEvents>

export function createWorkflowStream(abortSignal: AbortSignal) {
  let eventListeners: ReturnType<typeof window.ipcRendererApi.on>[] = []
  let currentSessionId: string | null = null
  let currentWorkflowId: string | null = null
  function cleanUp() {
    eventListeners.forEach((remove) => remove())
    eventListeners = []
  }
  const stream = new ReadableStream({
    start(controller) {
      // 鐩戝惉 abort 淇″彿
      abortSignal.addEventListener('abort', () => {
        if (currentSessionId && currentWorkflowId) {
          window.ipcRendererApi.invoke('agent-workflow-abort', {
            sessionId: currentSessionId,
            workflowId: currentWorkflowId,
          })
        }
      })

      agentEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (currentSessionId === data.sessionId) {
            controller.enqueue({ type: eventName, data })
          }

          if (currentSessionId === data.sessionId && eventName === 'agent-session-finished') {
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
          if (
            eventName === 'workflow-start' &&
            currentSessionId === null &&
            currentWorkflowId === null
          ) {
            currentSessionId = data.ctx.sessionId
            currentWorkflowId = data.ctx.workflowId
          }
          if (currentSessionId === data.ctx.sessionId) {
            controller.enqueue({ type: eventName, data })
          }

          if (
            currentSessionId === data.ctx.sessionId &&
            (eventName === 'workflow-error' || eventName === 'workflow-aborted')
          ) {
            controller.close()
            cleanUp()
          }
        })
        eventListeners.push(remove)
      })
    },
    cancel() {
      // 娓呯悊鎵€鏈夌洃鍚櫒
      cleanUp()
    },
  })
  return stream
}

export function resumeWorkflowStream(
  sessionId: string,
  workflowId: string,
  abortSignal: AbortSignal
) {
  let eventListeners: ReturnType<typeof window.ipcRendererApi.on>[] = []
  function cleanUp() {
    eventListeners.forEach((remove) => remove())
    eventListeners = []
  }
  const stream = new ReadableStream({
    start(controller) {
      // 鐩戝惉 abort 淇″彿
      abortSignal.addEventListener('abort', () => {
        if (sessionId && workflowId) {
          window.ipcRendererApi.invoke('agent-workflow-abort', {
            sessionId: sessionId,
            workflowId: workflowId,
          })
        }
      })

      agentEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (sessionId === data.sessionId) {
            controller.enqueue({ type: eventName, data })
          }

          if (sessionId === data.sessionId && eventName === 'agent-session-finished') {
            controller.close()
            cleanUp()
          }
        })
        eventListeners.push(remove)
      })

      plannerEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (sessionId === data.sessionId) {
            controller.enqueue({ type: eventName, data })
          }
        })
        eventListeners.push(remove)
      })

      workflowEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (eventName === 'workflow-start' && sessionId === null && workflowId === null) {
            sessionId = data.ctx.sessionId
            workflowId = data.ctx.workflowId
          }
          if (sessionId === data.ctx.sessionId) {
            controller.enqueue({ type: eventName, data })
          }

          if (
            sessionId === data.ctx.sessionId &&
            (eventName === 'workflow-error' || eventName === 'workflow-aborted')
          ) {
            controller.close()
            cleanUp()
          }
        })
        eventListeners.push(remove)
      })
    },
    cancel() {
      // 娓呯悊鎵€鏈夌洃鍚櫒
      cleanUp()
    },
  })
  return stream
}
