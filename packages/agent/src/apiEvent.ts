import { workflowEvent } from './event'
import type { WorkflowEvents } from './event/channels'

export function onWorkflowEvent<T extends keyof WorkflowEvents>(
  event: T,
  handle: WorkflowEvents[T]
) {
  return workflowEvent.on(event, handle)
}
