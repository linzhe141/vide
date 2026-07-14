import { create } from 'zustand'

export type WebSearchResultItem = {
  content: string
  title: string
  link: string
  snippet?: string
  date?: string
  position?: number
}

export type WebSearchResult = {
  query?: string
  didYouMean?: string
  results?: WebSearchResultItem[]
  credits?: number
}

export type SelectedWebSearch = {
  id: string
  query: string
  result: WebSearchResult
  durationMs?: number
}

type WebSearchState = {
  selected: SelectedWebSearch | null
}

type WebSearchActions = {
  actions: {
    select: (data: SelectedWebSearch) => void
    clear: () => void
  }
}

export const useWebSearchStore = create<WebSearchState & WebSearchActions>((set) => ({
  selected: null,
  actions: {
    select(data) {
      set({ selected: data })
    },
    clear() {
      set({ selected: null })
    },
  },
}))

export const useSelectedWebSearch = () => useWebSearchStore((state) => state.selected)

export const useWebSearchStoreActions = () => useWebSearchStore((state) => state.actions)
