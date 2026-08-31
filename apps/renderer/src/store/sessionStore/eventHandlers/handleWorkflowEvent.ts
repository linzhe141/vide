import { uuid as nanoid } from '@/lib/uuid'
import type { WorkflowEvent } from '@vide/agent/event'
import type { Session, Workflow } from '../types'
import type { WorkflowState } from '../../../hooks/useAgentSessionEvent'
import { createWorkflowUiModel, rebuildWorkflowMessages } from '../workflowMessageModel'

type WorkflowEventContext = WorkflowState['ctx'] & {
  namespace?: string | null
  mainWorkflowId?: string | null
}

type WorkflowEventWithContext = WorkflowEvent & {
  ctx: WorkflowEventContext
}

export function handleWorkflowEvent(
  storeState: { sessions: Session[] },
  workflowEvent: WorkflowState
) {
  const sessionId = workflowEvent.ctx.sessionId
  const workflowId = workflowEvent.ctx.workflowId
  if (!sessionId || !workflowId) return

  const session = storeState.sessions.find((item) => item.sessionId === sessionId)
  if (!session) return

  const workflow = ensureRootWorkflow(session, workflowId, workflowEvent)
  if (!workflow) return

  applyWorkflowRuntime(session, workflow, workflowEvent)
  recordWorkflowEvent(workflow, workflowEvent)
  rebuildWorkflowMessages(workflow, session.thinkingMode)
  syncPendingSteeringMessages(workflow, workflowEvent)
}

function ensureRootWorkflow(
  session: Session,
  workflowId: string,
  workflowEvent: WorkflowState
): Workflow | undefined {
  if (workflowEvent.type === 'workflow.start') {
    const workflow = createWorkflowUiModel(
      workflowId,
      workflowEvent.input,
      workflowEvent.inputSource
    )
    const currentBranch = session.branches.find((item) => item.name === session.activeBranch)
    if (!currentBranch) {
      return undefined
    }

    const parentId = currentBranch.headWorkflowId
    session.workflowNodesMap[workflow.id] = {
      workflow,
      children: [],
      parent: parentId,
    }
    if (parentId && session.workflowNodesMap[parentId]) {
      session.workflowNodesMap[parentId].children.push(workflow.id)
    }
    currentBranch.headWorkflowId = workflow.id
    session.runtime.running = true
    return workflow
  }

  return session.workflowNodesMap[workflowId]?.workflow
}

function applyWorkflowRuntime(
  session: Session,
  workflow: Workflow,
  workflowEvent: WorkflowEventWithContext
) {
  switch (workflowEvent.type) {
    case 'workflow.completed':
      session.runtime.running = false
      workflow.runtime.status = 'finished'
      return

    case 'workflow.interrupted':
      session.runtime.running = true
      workflow.runtime.status = 'interrupted'
      return

    case 'workflow.aborted':
      session.runtime.running = false
      workflow.runtime.status = 'aborted'
      return

    case 'workflow.error':
    case 'workflow.llm.error':
      session.runtime.running = false
      workflow.runtime.status = 'error'
      return

    default:
      return
  }
}

function recordWorkflowEvent(workflow: Workflow, workflowEvent: WorkflowEventWithContext) {
  workflow.events ??= []
  workflow.events.push({
    id: nanoid(),
    type: workflowEvent.type,
    createdAt: Date.now(),
    payload: sanitizeWorkflowEventPayload(workflowEvent),
  })
}

function sanitizeWorkflowEventPayload(workflowEvent: WorkflowEventWithContext) {
  const { ctx: _ctx, ...payload } = workflowEvent
  return payload
}

function syncPendingSteeringMessages(workflow: Workflow, workflowEvent: WorkflowEventWithContext) {
  workflow.runtime.pendingSteeringMessages ??= []

  if (workflowEvent.type !== 'workflow.context.input') {
    return
  }

  workflow.runtime.pendingSteeringMessages = workflow.runtime.pendingSteeringMessages.filter(
    (message) => message.id !== workflowEvent.messageId
  )
}
