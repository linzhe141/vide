import type { AgentEvents } from './channels'

export class AgentEvent {
  private listeners: { [K in keyof AgentEvents]?: Array<AgentEvents[K]> } = {}

  on<K extends keyof AgentEvents>(event: K, handler: AgentEvents[K]) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(handler)
    return () => {
      const targetIndex = this.listeners[event]!.findIndex((i) => i === handler)
      if (targetIndex !== -1) {
        this.listeners[event]!.splice(targetIndex, 1)
      }
    }
  }

  emit<K extends keyof AgentEvents>(
    event: K,
    ...payload: Parameters<AgentEvents[K]>
  ) {
    const handlers = this.listeners[event]
    if (!handlers) return
    for (const handler of handlers) {
      // @ts-expect-error ignore
      handler(...payload)
    }
  }
}
