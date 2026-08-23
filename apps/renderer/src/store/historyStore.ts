import { create } from 'zustand'

/** 侧边栏最近会话列表展示的历史项（title/type/origin/时间戳由 historyStore 统一维护）。 */
export type HistoryItem = {
  sessionId: string
  title: string
  type: 'normal' | 'fork'
  sessionSource: 'desktop' | 'wechat-bot'
  origin: { sessionId: string; workflowId: string | null } | null
  createdAt: number
  updatedAt: number
}

type HistoryState = {
  items: HistoryItem[]
  loading: boolean
}

type HistoryActions = {
  actions: {
    /** 全量拉取（历史列表首次进入 / 手动刷新时用）。 */
    fetch: () => Promise<void>
    /** 插入或更新单个历史项（幂等，sessionId 相同则覆盖）。 */
    upsert: (item: HistoryItem) => void
    /** 更新标题，并刷新 updatedAt。 */
    updateTitle: (sessionId: string, title: string) => void
    /** 仅刷新 updatedAt（比如收到新的 workflow 事件时）。 */
    touch: (sessionId: string) => void
    clear: () => void
  }
}

export const useHistoryStore = create<HistoryState & HistoryActions>((set) => ({
  items: [],
  loading: false,
  actions: {
    async fetch() {
      set({ loading: true })
      try {
        const rows = await window.ipcRendererApi.invoke('get-sessions-list')
        set({
          items: rows.map((row) => ({
            sessionId: row.id,
            title: row.title,
            type: row.type ?? 'normal',
            sessionSource: row.sessionSource,
            origin:
              row.originSessionId != null
                ? { sessionId: row.originSessionId, workflowId: row.originWorkflowId }
                : null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        })
      } finally {
        set({ loading: false })
      }
    },
    upsert(item) {
      set((state) => {
        const index = state.items.findIndex((it) => it.sessionId === item.sessionId)
        if (index >= 0) {
          const next = [...state.items]
          next[index] = item
          return { items: next }
        }
        return { items: [...state.items, item] }
      })
    },
    updateTitle(sessionId, title) {
      set((state) => {
        const item = state.items.find((it) => it.sessionId === sessionId)
        if (!item) return state
        return {
          items: state.items.map((it) =>
            it.sessionId === sessionId ? { ...it, title, updatedAt: Date.now() } : it
          ),
        }
      })
    },
    touch(sessionId) {
      set((state) => {
        const item = state.items.find((it) => it.sessionId === sessionId)
        if (!item) return state
        return {
          items: state.items.map((it) =>
            it.sessionId === sessionId ? { ...it, updatedAt: Date.now() } : it
          ),
        }
      })
    },
    clear() {
      set({ items: [], loading: false })
    },
  },
}))

export const useHistoryItems = () => useHistoryStore((state) => state.items)
export const useHistoryStoreActions = () => useHistoryStore((state) => state.actions)
