import { agentEvent, plannerEvent, workflowEvent, artifactEvent } from './event'
import type {
  AgentLifecycleEvents,
  WorkflowEvents,
  PlannerEvents,
  ArtifactEvents,
} from './event/channels'

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

export function onPalnnerEvent<T extends keyof PlannerEvents>(event: T, handle: PlannerEvents[T]) {
  return plannerEvent.on(event, handle)
}

export function onArtifactEvent<T extends keyof ArtifactEvents>(
  event: T,
  handle: ArtifactEvents[T]
) {
  return artifactEvent.on(event, handle)
}
