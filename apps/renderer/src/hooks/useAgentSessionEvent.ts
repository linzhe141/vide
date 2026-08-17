import { useEffect } from 'react'
import { workflowV2EventNames, type WorkflowEvent } from '@vide/agent/event'
import { useSessionStoreActions } from '../store/sessionStore'

export type WorkflowState = WorkflowEvent & {
  ctx: { sessionId: string | null; workflowId: string | null }
}

/**
 * 全局的 agent 事件长连接。
 *
 * 在应用顶层（app.tsx）挂载一次即可，之后所有 workflow（以及后续补充的 session 级）
 * IPC 事件都会在这里被统一接收，并按 ctx.sessionId 路由到 session store。
 *
 * 相比以前的 stream 风格：
 * - 不需要在每次 send 时重新注册/注销一堆 ipc 监听；
 * - send 只是 fire-and-forget，事件流由这里全局分发。
 *
 * @example
 * function App() {
 *   useAgentSessionEvent()
 *   return <AppView />
 * }
 */
export function useAgentSessionEvent() {
  const { handleEvent } = useSessionStoreActions()

  useEffect(() => {
    const disposers = workflowV2EventNames.map((eventName) =>
      window.ipcRendererApi.on(eventName, (data: WorkflowState) => {
        handleEvent(data)
      })
    )
    return () => {
      disposers.forEach((remove) => remove())
    }
  }, [handleEvent])
}
