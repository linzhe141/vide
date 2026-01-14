import { agentEvent, llmEvent, theadEvent, toolEvent, workflowEvent } from './event'
import type {
  AgentLifecycleEvents,
  LLMEvents,
  TheadEvents,
  ToolEvents,
  WorkflowEvents,
} from './event/channels'

export function onAgentEvent<T extends keyof AgentLifecycleEvents>(
  event: T,
  handle: AgentLifecycleEvents[T]
) {
  return agentEvent.on(event, handle)
}

export function onSessionEvent<T extends keyof TheadEvents>(event: T, handle: TheadEvents[T]) {
  return theadEvent.on(event, handle)
}

export function onWorkflowEvent<T extends keyof WorkflowEvents>(
  event: T,
  handle: WorkflowEvents[T]
) {
  return workflowEvent.on(event, handle)
}

export function onLLMEvent<T extends keyof LLMEvents>(event: T, handle: LLMEvents[T]) {
  return llmEvent.on(event, handle)
}

export function onToolEvent<T extends keyof ToolEvents>(event: T, handle: ToolEvents[T]) {
  return toolEvent.on(event, handle)
}
