import { agentEvent, plannerEvent, workflowEvent } from './event'
import type { AgentLifecycleEvents, WorkflowEvents, PlannerEvents } from './event/channels'

export function onAgentEvent<T extends keyof AgentLifecycleEvents>(
  event: T,
  handle: AgentLifecycleEvents[T]
) {
  return agentEvent.on(event, handle)
}

export function onWorkflowEvent<T extends keyof WorkflowEvents>(
  event: T,
  handle: WorkflowEvents[T]
) {
  return workflowEvent.on(event, handle)
}

export function onPalnnervent<T extends keyof PlannerEvents>(event: T, handle: PlannerEvents[T]) {
  return plannerEvent.on(event, handle)
}
