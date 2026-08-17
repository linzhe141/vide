import { useEffect } from 'react'
import {
  workflowV2EventNames,
  sessionEventNames,
  type SessionEvent,
  type WorkflowEvent,
} from '@vide/agent/event'
import { useSessionStoreActions } from '../store/sessionStore'

export type WorkflowState = WorkflowEvent & {
  ctx: { sessionId: string | null; workflowId: string | null }
}

/**
 * 全局的 agent 事件长连接。
 *
 * 在应用顶层（app.tsx）挂载一次即可，之后所有 workflow（以及 session 级）IPC 事件
 * 都会在这里被统一接收，并按事件类型路由到对应的 zustand store：
 *
 * - workflow.* 事件 → sessionStore.handleEvent，做 workflow / session runtime 的增量更新；
 * - background-create-session → historyStore 新增 history item + sessionStore 创建占位 session；
 * - session-title / session-updated → historyStore 更新标题 / 时间戳。
 *
 * zustand 的响应式更新会自动触发依赖这些 store 的 UI 重新渲染，因此这里只需要
 * 简单地维护 IPC 监听，不需要在每次 send 时重新注册/注销。
 */
export function useAgentSessionEvent() {
  const { handleEvent, handleSessionEvent } = useSessionStoreActions()

  useEffect(() => {
    const disposers: (() => void)[] = []

    // workflow 级事件：统一交给 sessionStore 做 workflow 增量更新
    for (const eventName of workflowV2EventNames) {
      disposers.push(
        window.ipcRendererApi.on(eventName, (data: WorkflowState) => {
          handleEvent(data)
        })
      )
    }

    // session 级事件：路由到 sessionStore/historyStore 做后台更新
    for (const eventName of sessionEventNames) {
      disposers.push(
        window.ipcRendererApi.on(eventName, (data: SessionEvent) => {
          handleSessionEvent(data)
        })
      )
    }

    return () => {
      disposers.forEach((remove) => remove())
    }
  }, [handleEvent, handleSessionEvent])
}
