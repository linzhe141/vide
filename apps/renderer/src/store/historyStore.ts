import { create } from 'zustand'

/** 侧边栏最近会话列表展示的历史项（来自 DB sessions 表）。 */
export type HistoryItem = {
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
}

type HistoryState = {
  items: HistoryItem[]
  loading: boolean
}

type HistoryActions = {
  actions: {
    fetch: () => Promise<void>
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
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        })
      } finally {
        set({ loading: false })
      }
    },
    clear() {
      set({ items: [], loading: false })
    },
  },
}))

export const useHistoryItems = () => useHistoryStore((state) => state.items)
export const useHistoryStoreActions = () => useHistoryStore((state) => state.actions)
