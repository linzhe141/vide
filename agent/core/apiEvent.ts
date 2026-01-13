import {
  agentEvent,
  llmEvent,
  sessionEvent,
  toolEvent,
  workflowEvent,
} from './event'
import type {
  AgentLifecycleEvents,
  LLMEvents,
  SessionEvents,
  ToolEvents,
  WorkflowEvents,
} from './event/channels'

export function onAgentEvent<T extends keyof AgentLifecycleEvents>(
  event: T,
  handle: AgentLifecycleEvents[T]
) {
  agentEvent.on(event, handle)
}

export function onSessionEvent<T extends keyof SessionEvents>(
  event: T,
  handle: SessionEvents[T]
) {
  sessionEvent.on(event, handle)
}

export function onWorkflowEvent<T extends keyof WorkflowEvents>(
  event: T,
  handle: WorkflowEvents[T]
) {
  workflowEvent.on(event, handle)
}

export function onLLMEvent<T extends keyof LLMEvents>(
  event: T,
  handle: LLMEvents[T]
) {
  llmEvent.on(event, handle)
}

export function onToolEvent<T extends keyof ToolEvents>(
  event: T,
  handle: ToolEvents[T]
) {
  toolEvent.on(event, handle)
}
