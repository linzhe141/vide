import type { WorkflowState } from '../../../hooks/createWorkflowStream'
import type {
  AssistantReasonSessionMessage,
  AssistantTextSessionMessage,
  BlockNode,
  ConversationBlock,
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
  block?: ConversationBlock
  planner?: Session['planner'][number]
  event: WorkflowState

  // operates
  pushBlock(block: ConversationBlock): void
  pushMessage(message: SessionMessage): void
  ensureLastMessage(
    role: 'assistant-reason' | 'assistant-text'
  ): AssistantReasonSessionMessage | AssistantTextSessionMessage

  commitBranch(blockNodeId: string): void
  updateBlockRuntime(dispatch: (runtime: ConversationBlock['runtime']) => void): void
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
  const block = session && workflowId ? session.blockNodesMap[workflowId]?.workflowNode : undefined
  const plannerId = 'plannerId' in event.data ? event.data.plannerId : undefined
  const planner = session?.planner.find((p) => p.id === plannerId)

  return {
    state,
    sessionId,
    session,
    currentBranch,
    block,
    planner,
    event,
    // operates
    pushBlock(block) {
      if (!session) throw new Error('No session found for this event, this is a internal error')
      if (!currentBranch)
        throw new Error('No branch found for this event, this is a internal error')
      const newBlockNode: BlockNode = {
        workflowNode: block,
        children: [],
        parent: null,
      }
      session.blockNodesMap[block.id] = newBlockNode
      const parentBlockNode = session.blockNodesMap[currentBranch.headBlockId!]
      const headBlockId = currentBranch.headBlockId
      // headBlockId === null 表示 main分支的第一个节点
      if (headBlockId === null) {
        // 第一个workflow node 作为 main分支的sourceBlock
        currentBranch.sourceBlockId = block.id
      }
      currentBranch.headBlockId = block.id
      if (parentBlockNode) {
        parentBlockNode.children.push(block.id)
        newBlockNode.parent = parentBlockNode.workflowNode.id
      }
    },
    pushMessage(message: SessionMessage) {
      if (!block) throw new Error('No block found for this event, this is a internal error')
      block.messages.push(message)
    },
    ensureLastMessage(role: 'assistant-reason' | 'assistant-text') {
      if (!block) throw new Error('No block found for this event, this is a internal error')
      const last = block.messages.at(-1)
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
        block.messages.push(message)
        return message
      }
      return last
    },
    commitBranch(blockNodeId) {
      if (!session) throw new Error('No session found for this event, this is a internal error')
      if (!currentBranch)
        throw new Error('No branch found for this event, this is a internal error')
      currentBranch.headBlockId = blockNodeId
    },
    updateBlockRuntime(dispatch) {
      if (!block) throw new Error('No block found for this event, this is a internal error')
      dispatch(block.runtime)
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
