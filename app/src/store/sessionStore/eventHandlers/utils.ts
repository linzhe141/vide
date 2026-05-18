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
import { sessionBlocksMap, sessionBlockNodeMap } from '..'

type SessionEventContext = {
  state: { sessions: Session[] }
  sessionId?: string
  session?: Session
  currentBranch?: SessionBranch
  block?: ConversationBlock
  planner?: Session['planner'][number]
  event: WorkflowState

  // operates
  pushSession(session: Session): void
  pushBlock(block: ConversationBlock): void
  pushMessage(message: SessionMessage): void
  ensureLastMessage(
    role: 'assistant-reason' | 'assistant-text'
  ): AssistantReasonSessionMessage | AssistantTextSessionMessage

  createBranch(branch: SessionBranch): void
  switchBranch(branchName: string): void
  commitBranch(blockNode: BlockNode): void
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
  const block = sessionId && workflowId ? sessionBlocksMap.get(sessionId)?.[workflowId] : undefined
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

      const targetSessionBlocks = sessionBlocksMap.get(session.sessionId)
      if (targetSessionBlocks) {
        targetSessionBlocks[block.id] = block
      } else {
        sessionBlocksMap.set(session.sessionId, {
          [block.id]: block,
        })
      }

      const targetBaranch = session.branches.find((item) => item.name === session.activeBranch)
      if (targetBaranch) {
        const newBlockNode: BlockNode = {
          workflowNode: block,
          children: [],
          parent: targetBaranch.headBlock,
        }
        const existingMap = sessionBlockNodeMap.get(session.sessionId)!
        if (!existingMap) {
          sessionBlockNodeMap.set(session.sessionId, {
            [block.id]: newBlockNode,
          })
        } else {
          existingMap[block.id] = newBlockNode
        }

        const parentBlockNode = targetBaranch.headBlock
        targetBaranch.headBlock = newBlockNode
        if (parentBlockNode) {
          parentBlockNode.children.push(newBlockNode)
        }
      }
    },
    pushSession(session) {
      state.sessions.push(session)
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
    createBranch(branch) {
      if (!session) throw new Error('No session found for this event, this is a internal error')
      session.branches.push(branch)
    },
    switchBranch(branchName) {
      if (!session) throw new Error('No session found for this event, this is a internal error')
      session.activeBranch = branchName
    },
    commitBranch(blockNode) {
      if (!session) throw new Error('No session found for this event, this is a internal error')
      const branch = session.branches.find((item) => item.name === session.activeBranch)
      if (!branch) throw new Error('No branch found for this event')
      branch.headBlock = blockNode
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
