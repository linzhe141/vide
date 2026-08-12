import { workflowV2EventNames, type WorkflowEvent } from '@vide/agent/event'

type WorkflowEventWithCtx = WorkflowEvent & {
  ctx: { sessionId: string | null; workflowId: string | null }
}

export type WorkflowState = WorkflowEventWithCtx
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
      abortSignal.addEventListener('abort', () => {
        if (currentSessionId) {
          window.ipcRendererApi.invoke('agent-session-abort', {
            sessionId: currentSessionId,
          })
        }
      })

      workflowV2EventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: WorkflowEventWithCtx) => {
          console.log('workflow event received', eventName, data)
          if (
            data.type === 'workflow.start' &&
            currentSessionId === null &&
            currentWorkflowId === null
          ) {
            currentSessionId = data.ctx.sessionId
            currentWorkflowId = data.ctx.workflowId
          }
          if (currentSessionId === data.ctx.sessionId) {
            controller.enqueue(data)
          }

          if (
            currentSessionId === data.ctx.sessionId &&
            (data.type === 'workflow.error' ||
              data.type === 'workflow.completed' ||
              data.type === 'workflow.interrupted' ||
              data.type === 'workflow.aborted')
          ) {
            controller.close()
            cleanUp()
          }
        })
        eventListeners.push(remove)
      })
    },
    cancel() {
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
      abortSignal.addEventListener('abort', () => {
        controller.close()
        cleanUp()
      })

      workflowV2EventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: WorkflowEventWithCtx) => {
          if (data.type === 'workflow.start' && sessionId === null && workflowId === null) {
            if (!data.ctx.sessionId || !data.ctx.workflowId) return
            sessionId = data.ctx.sessionId
            workflowId = data.ctx.workflowId
          }
          if (sessionId === data.ctx.sessionId) {
            controller.enqueue(data)
          }

          if (
            sessionId === data.ctx.sessionId &&
            (data.type === 'workflow.error' ||
              data.type === 'workflow.completed' ||
              data.type === 'workflow.interrupted' ||
              data.type === 'workflow.aborted')
          ) {
            controller.close()
            cleanUp()
          }
        })
        eventListeners.push(remove)
      })
    },
    cancel() {
      cleanUp()
    },
  })
  return stream
}
