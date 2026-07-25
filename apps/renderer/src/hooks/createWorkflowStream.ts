import { workflowEventNames, type WorkflowEventWithCtx } from '@vide/agent/event'

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
        if (currentSessionId && currentWorkflowId) {
          window.ipcRendererApi.invoke('agent-workflow-abort', {
            sessionId: currentSessionId,
            workflowId: currentWorkflowId,
          })
        }
      })

      workflowEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (
            eventName === 'workflow-start' &&
            data.ctx.namespace === undefined &&
            currentSessionId === null &&
            currentWorkflowId === null
          ) {
            currentSessionId = data.ctx.sessionId
            currentWorkflowId = data.ctx.workflowId
          }
          if (currentSessionId === data.ctx.sessionId) {
            console.log(eventName, data)
            controller.enqueue({ eventName, data })
          }

          if (
            currentSessionId === data.ctx.sessionId &&
            data.ctx.namespace === undefined &&
            (eventName === 'workflow-error' ||
              eventName === 'workflow-aborted' ||
              eventName === 'workflow-finished')
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
        if (sessionId && workflowId) {
          window.ipcRendererApi.invoke('agent-workflow-abort', {
            sessionId: sessionId,
            workflowId: workflowId,
          })
        }
      })

      workflowEventNames.forEach((eventName) => {
        const remove = window.ipcRendererApi.on(eventName, (data: any) => {
          if (
            eventName === 'workflow-start' &&
            data.ctx.namespace === undefined &&
            sessionId === null &&
            workflowId === null
          ) {
            sessionId = data.ctx.sessionId
            workflowId = data.ctx.workflowId
          }
          if (sessionId === data.ctx.sessionId) {
            controller.enqueue({ eventName, data })
          }

          if (
            sessionId === data.ctx.sessionId &&
            data.ctx.namespace === undefined &&
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
      cleanUp()
    },
  })
  return stream
}
