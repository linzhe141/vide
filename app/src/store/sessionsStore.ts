import { create } from 'zustand'

type State = {
  sessions: { id: string; title?: string }[]
}

type Actions = {
  setSessions: (data: { id: string; title?: string }[]) => void
}

export const useSessionsStore = create<State & Actions>((set) => ({
  sessions: [],
  setSessions: (data) => set({ sessions: data }),
}))
