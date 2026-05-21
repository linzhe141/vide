import { create } from 'zustand'

type State = {
  sessions: {
    id: string
    title?: string
    type: 'normal' | 'fork'
    originSessionId: string | null
    originWorkflowId: string | null
  }[]
}

type Actions = {
  setSessions: (data: State['sessions']) => void
}

export const useSessionsStore = create<State & Actions>((set) => ({
  sessions: [],
  setSessions: (data) => set({ sessions: data }),
}))
