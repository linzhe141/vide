import type {
  Events,
  AgentLifecycleEvents,
  TheadEvents,
  WorkflowEvents,
  LLMEvents,
  ToolEvents,
} from './channels'

export class EventEmitter<T extends Events> {
  private listeners: { [K in keyof T]?: Array<T[K]> } = {}

  on<K extends keyof T>(event: K, handler: T[K]) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(handler)
    return () => {
      const targetIndex = this.listeners[event]!.findIndex((i) => i === handler)
      if (targetIndex !== -1) {
        this.listeners[event]!.splice(targetIndex, 1)
      }
    }
  }
  //@ts-expect-error ignore todo
  emit<K extends keyof T>(event: K, ...payload: Parameters<T[K]>) {
    const handlers = this.listeners[event]
    if (!handlers) return
    for (const handler of handlers) {
      // @ts-expect-error ignore
      handler(...payload)
    }
  }
}

export const llmEvent = new EventEmitter<LLMEvents>()
export const toolEvent = new EventEmitter<ToolEvents>()
export const theadEvent = new EventEmitter<TheadEvents>()
export const workflowEvent = new EventEmitter<WorkflowEvents>()
export const agentEvent = new EventEmitter<AgentLifecycleEvents>()
