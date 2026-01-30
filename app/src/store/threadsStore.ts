import { create } from 'zustand'

type State = {
  threads: { id: string; title?: string }[]
}

type Actions = {
  setThreads: (data: { id: string; title?: string }[]) => void
}

export const useThreadsStore = create<State & Actions>((set) => ({
  threads: [],
  setThreads: (data) => set({ threads: data }),
}))
