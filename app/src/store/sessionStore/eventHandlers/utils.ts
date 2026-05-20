import type { WorkflowState } from '../../../hooks/createWorkflowStream'
import type {
  AssistantReasonSessionMessage,
  AssistantTextSessionMessage,
  WorkflowNode,
  Workflow,
  Session,
  SessionBranch,
  SessionMessage,
} from '../types'
import { nanoid } from 'nanoid'

type SessionEventContext = {
  state: { sessions: Session[] }
  sessionId?: string
  session?: Session
  currentBranch?: SessionBranch
  workflow?: Workflow
  planner?: Session['planner'][number]
  event: WorkflowState

  // operates
  pushWorkflow(workflow: Workflow): void
  pushMessage(message: SessionMessage): void
  ensureLastMessage(
    role: 'assistant-reason' | 'assistant-text'
  ): AssistantReasonSessionMessage | AssistantTextSessionMessage

  commitBranch(workflowNodeId: string): void
  updateWorkflowRuntime(dispatch: (runtime: Workflow['runtime']) => void): void
}

export function createSessionEventContext(
  state: { sessions: Session[] },
  event: WorkflowState
): SessionEventContext {
  const sessionId = getEventSessionId(event)
  const session = state.sessions.find((item) => item.sessionId === sessionId)
  const currentBranch = session
    ? session.branches.find((item) => item.name === session.activeBranch)
    : undefined
  const workflowId = 'ctx' in event.data ? event.data.ctx.workflowId : undefined
  const workflow =
    session && workflowId ? session.workflowNodesMap[workflowId]?.workflow : undefined
  const plannerId = 'plannerId' in event.data ? event.data.plannerId : undefined
  const planner = session?.planner.find((p) => p.id === plannerId)

  return {
    state,
    sessionId,
    session,
    currentBranch,
    workflow,
    planner,
    event,
    // operates
    pushWorkflow(workflow) {
      if (!session) throw new Error('No session found for this event, this is a internal error')
      if (!currentBranch)
        throw new Error('No branch found for this event, this is a internal error')
      const newWorkflowNode: WorkflowNode = {
        workflow,
        children: [],
        parent: null,
      }
      session.workflowNodesMap[workflow.id] = newWorkflowNode
      const parentWorkflowNode = session.workflowNodesMap[currentBranch.headWorkflowId!]
      const headWorkflowId = currentBranch.headWorkflowId
      // headWorkflowId === null 表示 main分支的第一个节点
      if (headWorkflowId === null) {
        // 第一个workflow node 作为 main分支的sourceWorkflow
        currentBranch.sourceWorkflowId = workflow.id
      }
      currentBranch.headWorkflowId = workflow.id
      if (parentWorkflowNode) {
        parentWorkflowNode.children.push(workflow.id)
        newWorkflowNode.parent = parentWorkflowNode.workflow.id
      }
    },
    pushMessage(message: SessionMessage) {
      if (!workflow) throw new Error('No workflow found for this event, this is a internal error')
      workflow.messages.push(message)
    },
    ensureLastMessage(role: 'assistant-reason' | 'assistant-text') {
      if (!workflow) throw new Error('No workflow found for this event, this is a internal error')
      const last = workflow.messages.at(-1)
      let message: AssistantReasonSessionMessage | AssistantTextSessionMessage = null!
      if (!last || last.role !== role) {
        switch (role) {
          case 'assistant-reason': {
            message = {
              id: nanoid(),
              role,
              content: '',
              reasoning: false,
            } as AssistantReasonSessionMessage
            break
          }
          case 'assistant-text': {
            message = {
              id: nanoid(),
              role,
              content: '',
            } as AssistantTextSessionMessage
            break
          }
        }
        workflow.messages.push(message)
        return message
      }
      return last
    },
    commitBranch(workflowNodeId) {
      if (!session) throw new Error('No session found for this event, this is a internal error')
      if (!currentBranch)
        throw new Error('No branch found for this event, this is a internal error')
      currentBranch.headWorkflowId = workflowNodeId
    },
    updateWorkflowRuntime(dispatch) {
      if (!workflow) throw new Error('No workflow found for this event, this is a internal error')
      dispatch(workflow.runtime)
    },
  }
}

function getEventSessionId(event: WorkflowState) {
  if ('ctx' in event.data) {
    return event.data.ctx.sessionId
  }

  if ('sessionId' in event.data) {
    return event.data.sessionId
  }

  return undefined
}
