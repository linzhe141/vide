import { startTransition, useEffect } from 'react'
import type { SessionEvent, WorkflowEvent } from '@vide/agent/event'
import { useHistoryStore } from '../store/historyStore'
import { useSessionStoreActions } from '../store/sessionStore'

export type WorkflowState = WorkflowEvent & {
  ctx: { sessionId: string | null; workflowId: string | null }
}

type AgentEventBatch = {
  events: Array<SessionEvent | WorkflowState>
}

/**
 * 全局的 agent 事件长连接。
 *
 * 在应用顶层（app.tsx）挂载一次即可，之后所有 workflow（以及 session 级）socket 事件
 * 都会在这里被统一接收，并按事件类型路由到对应的 zustand store：
 *
 * - workflow.* 事件 → sessionStore.handleEvent，做 workflow / session runtime 的增量更新；
 * - background-create-session → historyStore 新增 history item + sessionStore 创建占位 session；
 * - session-title / session-updated → historyStore 更新标题 / 时间戳。
 *
 * zustand 的响应式更新会自动触发依赖这些 store 的 UI 重新渲染，因此这里只需要
 * 简单地维护单条 WebSocket，不需要在每次 send 时重新注册/注销。
 */
export function useAgentSessionEvent() {
  const { handleEvents, createSession, queueSteeringMessage } = useSessionStoreActions()

  useEffect(() => {
    const disposers: (() => void)[] = []
    const historyActions = useHistoryStore.getState().actions
    const queuedWorkflowEvents: WorkflowState[] = []
    let flushHandle: number | null = null
    let cancelFlush: ((handle: number) => void) | null = null
    let reconnectHandle: number | null = null
    let socket: WebSocket | null = null
    let disposed = false

    const flushWorkflowEvents = () => {
      flushHandle = null
      cancelFlush = null

      if (!queuedWorkflowEvents.length) return

      const events = queuedWorkflowEvents.splice(0, queuedWorkflowEvents.length)
      startTransition(() => {
        handleEvents(events)
      })
    }

    const scheduleWorkflowFlush = () => {
      if (flushHandle !== null) return

      if (document.visibilityState === 'visible') {
        cancelFlush = window.cancelAnimationFrame
        flushHandle = window.requestAnimationFrame(flushWorkflowEvents)
        return
      }

      cancelFlush = window.clearTimeout
      flushHandle = window.setTimeout(flushWorkflowEvents, 16)
    }

    const handleSessionEvent = (data: SessionEvent) => {
      switch (data.type) {
        case 'background-create-session': {
          historyActions.upsert({
            sessionId: data.sessionId,
            title: data.title ?? '',
            type: data.sessionType ?? 'normal',
            sessionSource: data.sessionSource,
            origin: data.origin ?? null,
            createdAt: data.createdAt ?? Date.now(),
            updatedAt: data.updatedAt ?? Date.now(),
          })

          createSession({
            sessionId: data.sessionId,
            sessionSource: data.sessionSource,
            workspacePath: data.workspacePath,
            autoApprove: data.autoApprove,
            thinkingMode: data.thinkingMode,
          })
          return
        }

        case 'session-title': {
          historyActions.updateTitle(data.sessionId, data.title)
          return
        }

        case 'session-steering-queued': {
          historyActions.touch(data.sessionId)
          queueSteeringMessage({
            sessionId: data.sessionId,
            workflowId: data.workflowId,
            messageId: data.messageId,
            content: data.content,
            inputSource: data.inputSource,
            createdAt: data.createdAt,
          })
          return
        }

        case 'session-updated': {
          const item = useHistoryStore
            .getState()
            .items.find((it) => it.sessionId === data.sessionId)
          if (!item) return

          historyActions.upsert({
            ...item,
            title: data.title ?? item.title,
            createdAt: data.createdAt ?? item.createdAt,
            updatedAt: data.updatedAt ?? item.updatedAt,
          })
          return
        }

        default:
          return
      }
    }

    const queueWorkflowEvent = (data: WorkflowState) => {
      if (data.type === 'workflow.start' && data.ctx.sessionId) {
        historyActions.touch(data.ctx.sessionId)
      }

      queuedWorkflowEvents.push(data)
      scheduleWorkflowFlush()
    }

    const routeEvent = (event: SessionEvent | WorkflowState) => {
      if ('ctx' in event) {
        queueWorkflowEvent(event)
        return
      }

      handleSessionEvent(event)
    }

    const scheduleReconnect = () => {
      if (disposed || reconnectHandle !== null) return

      reconnectHandle = window.setTimeout(() => {
        reconnectHandle = null
        connect().catch(() => {
          scheduleReconnect()
        })
      }, 300)
    }

    const cleanupSocket = (target: WebSocket | null) => {
      if (!target) return
      target.onopen = null
      target.onmessage = null
      target.onerror = null
      target.onclose = null
      if (target.readyState === WebSocket.OPEN || target.readyState === WebSocket.CONNECTING) {
        target.close()
      }
    }

    const connect = async () => {
      if (disposed) return
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
      ) {
        return
      }

      try {
        const { url } = await window.ipcRendererApi.invoke('agent-event-stream-connect-info')
        if (disposed) return

        const nextSocket = new WebSocket(url)
        socket = nextSocket

        nextSocket.onmessage = (messageEvent) => {
          if (typeof messageEvent.data !== 'string') {
            return
          }

          let batch: AgentEventBatch
          try {
            batch = JSON.parse(messageEvent.data) as AgentEventBatch
          } catch {
            return
          }

          for (const event of batch.events) {
            routeEvent(event)
          }
        }

        nextSocket.onerror = () => {
          nextSocket.close()
        }

        nextSocket.onclose = () => {
          if (socket === nextSocket) {
            socket = null
          }
          scheduleReconnect()
        }
      } catch {
        scheduleReconnect()
      }
    }

    connect().catch(() => {
      scheduleReconnect()
    })

    return () => {
      disposed = true

      if (reconnectHandle !== null) {
        window.clearTimeout(reconnectHandle)
      }

      if (flushHandle !== null && cancelFlush) {
        cancelFlush(flushHandle)
      }

      if (queuedWorkflowEvents.length) {
        handleEvents(queuedWorkflowEvents.splice(0, queuedWorkflowEvents.length))
      }

      cleanupSocket(socket)
      socket = null

      disposers.forEach((remove) => remove())
    }
  }, [createSession, handleEvents, queueSteeringMessage])
}
