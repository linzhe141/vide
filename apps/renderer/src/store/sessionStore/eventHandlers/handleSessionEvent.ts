import type { SessionEvent } from '@vide/agent/event'
import { useHistoryStore } from '../../historyStore'
import { useSessionStore } from '../../sessionStore'

export function handleSessionEvent(event: SessionEvent) {
  switch (event.type) {
    case 'background-create-session': {
      const historyActions = useHistoryStore.getState().actions
      const sessionActions = useSessionStore.getState().actions

      // 1) historyStore 维护元数据
      historyActions.upsert({
        sessionId: event.sessionId,
        title: event.title ?? '',
        type: event.sessionType ?? 'normal',
        origin: event.origin ?? null,
        createdAt: event.createdAt ?? Date.now(),
        updatedAt: event.updatedAt ?? Date.now(),
      })

      // 2) sessionStore 创建占位 session（幂等）
      sessionActions.createSession({
        sessionId: event.sessionId,
        workspacePath: event.workspacePath,
        autoApprove: event.autoApprove,
        thinkingMode: event.thinkingMode,
      })
      return
    }

    case 'session-title': {
      useHistoryStore.getState().actions.updateTitle(event.sessionId, event.title)
      return
    }

    case 'session-updated': {
      const historyActions = useHistoryStore.getState().actions
      const item = useHistoryStore.getState().items.find((it) => it.sessionId === event.sessionId)
      if (item) {
        historyActions.upsert({
          ...item,
          title: event.title ?? item.title,
          createdAt: event.createdAt ?? item.createdAt,
          updatedAt: event.updatedAt ?? item.updatedAt,
        })
      }
      return
    }

    default:
      return
  }
}
