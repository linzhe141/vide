import { nanoid } from 'nanoid'
import { ASK_USER_TOOL_NAMES } from '@/agent/core/tools/askUserQuestion'
import type {
  ConversationBlock,
  PlanStep,
  SessionBranch,
  Session,
  SessionMessage,
  SessionState,
} from '.'
import type { WorkflowState } from '../../hooks/createWorkflowStream'

type SessionEventContext = {
  state: SessionState
  sessionId?: string
  session?: Session
  block?: ConversationBlock
  planner?: Session['planner'][number]
  event: WorkflowState
}

export function handleWorkflowEvent(storeState: SessionState, workflowEvent: WorkflowState) {
  const context = createSessionEventContext(storeState, workflowEvent)
  const { event, state, session, block, planner } = context

  switch (event.type) {
    case 'agent-create-session': {
      getOrCreateSession(state, event.data.sessionId, event.data.activeBranch)
      return
    }

    case 'agent-session-forked': {
      if (!session) return
      upsertBranch(session, {
        name: event.data.branchName,
        headBlockId: event.data.sourceWorkflowId,
      })
      session.activeBranch = event.data.branchName
      session.currentBlockId = event.data.sourceWorkflowId || undefined
      return
    }

    case 'workflow-start': {
      const { sessionId, workflowId, parentWorkflowId, branchName } = event.data.ctx
      const targetSession = getOrCreateSession(state, sessionId, branchName)
      const createdBlock = createConversationBlock(workflowId, event.data.input, parentWorkflowId)

      targetSession.runtime.running = true
      targetSession.blockMap[workflowId] = createdBlock
      if (!targetSession.blockOrder.includes(workflowId)) {
        targetSession.blockOrder.push(workflowId)
      }
      if (parentWorkflowId) {
        const parentBlock = targetSession.blockMap[parentWorkflowId]
        if (parentBlock && !parentBlock.childBlockIds.includes(workflowId)) {
          parentBlock.childBlockIds.push(workflowId)
        }
      }
      targetSession.currentBlockId = workflowId
      targetSession.activeBranch = branchName
      upsertBranch(targetSession, {
        name: branchName,
        headBlockId: workflowId,
      })
      return
    }

    case 'workflow-finished':
      if (!block || !session) return
      block.status = 'finished'
      session.runtime.running = false
      return

    case 'workflow-error':
      if (!block || !session) return
      block.status = 'error'
      session.runtime.running = false
      pushMessage(block, {
        id: nanoid(),
        role: 'error',
        error: event.data.error instanceof Error ? event.data.error.message : event.data.error,
      })
      return

    case 'workflow-wait-human-approve':
      if (!block) return
      block.runtime.waitingHuman = true
      return

    case 'workflow-llm-start':
      if (!block) return
      block.runtime.isStreaming = true
      return

    case 'workflow-llm-end':
      if (!block) return
      block.runtime.isStreaming = false
      return

    case 'workflow-llm-reasoning-delta': {
      if (!block) return
      const reasoningMessage = ensureLastReasoningMessage(block)
      reasoningMessage.content += event.data.chunk.delta
      reasoningMessage.reasoning += event.data.chunk.delta
      return
    }

    case 'workflow-llm-text-delta':
      if (!block) return
      ensureLastMessage(block, 'assistant-text').content += event.data.chunk.delta
      return

    case 'workflow-llm-tool-calls-end':
      if (!block) return
      pushMessage(block, {
        id: nanoid(),
        role: 'tool-call',
        toolCalls: event.data.toolCalls,
      })
      return

    case 'workflow-tool-call-start':
      return

    case 'workflow-tool-call-success':
      if (!block) return
      pushMessage(block, {
        id: nanoid(),
        role: 'tool-result',
        toolCallId: event.data.toolCallResult.id,
        status: 'success',
        result: event.data.toolCallResult.result,
        startedAt: event.data.toolCallResult.startedAt,
        finishedAt: event.data.toolCallResult.finishedAt,
        durationMs: event.data.toolCallResult.durationMs,
      })
      if (event.data.toolCallResult.toolName === ASK_USER_TOOL_NAMES.GENERATE) {
        const question = event.data.toolCallResult.result?.question
        if (question) {
          block.runtime.waitingHuman = true
          pushMessage(block, createAskUserMessage(question))
        }
      }
      return

    case 'workflow-tool-call-error':
      if (!block) return
      if (event.data.toolCallResult.id) {
        pushMessage(block, {
          id: nanoid(),
          role: 'tool-result',
          toolCallId: event.data.toolCallResult.id,
          status: 'error',
          error: event.data.toolCallResult.error,
          startedAt: event.data.toolCallResult.startedAt,
          finishedAt: event.data.toolCallResult.finishedAt,
          durationMs: event.data.toolCallResult.durationMs,
        })
      }
      return

    case 'planner-end-generate': {
      if (!session) return
      session.currentPlannerId = event.data.plannerId
      session.planner.push({
        id: event.data.plannerId,
        plan: event.data.plans,
      })
      return
    }

    case 'planner-execute-item-start':
      updatePlannerStepStatus(planner, event.data.plan.id, 'running')
      return

    case 'planner-execute-item-success':
      updatePlannerStepStatus(planner, event.data.plan.id, 'completed')
      return

    case 'planner-execute-item-error':
      updatePlannerStepStatus(planner, event.data.plan.id, 'failed')
      return
  }
}

function createSessionEventContext(state: SessionState, event: WorkflowState): SessionEventContext {
  const sessionId = getEventSessionId(event)
  const session = sessionId ? state.sessions.find((item) => item.sessionId === sessionId) : undefined
  const workflowId = 'ctx' in event.data ? event.data.ctx.workflowId : undefined
  const block = workflowId && session ? session.blockMap[workflowId] : undefined
  const planner = session ? getCurrentPlanner(session) : undefined

  return {
    state,
    sessionId,
    session,
    block,
    planner,
    event,
  }
}

function createConversationBlock(
  workflowId: string,
  input: string,
  parentBlockId: string | null
): ConversationBlock {
  return {
    id: workflowId,
    parentBlockId,
    childBlockIds: [],
    input,
    status: 'running',
    messages: [
      {
        id: nanoid(),
        role: 'user',
        content: input,
      },
    ],
    runtime: {
      isStreaming: false,
      waitingHuman: false,
    },
  }
}

function getOrCreateSession(state: SessionState, sessionId: string, activeBranch: string) {
  let session = state.sessions.find((item) => item.sessionId === sessionId)
  if (session) return session

  session = {
    sessionId,
    activeBranch,
    branches: [{ name: activeBranch, headBlockId: null }],
    planner: [],
    blockMap: {},
    blockOrder: [],
    runtime: {
      running: false,
    },
    artifacts: [],
  }
  state.sessions.push(session)

  return session
}

function upsertBranch(session: Session, branch: SessionBranch) {
  const target = session.branches.find((item) => item.name === branch.name)
  if (target) {
    target.headBlockId = branch.headBlockId
    return
  }
  session.branches.push(branch)
}

function ensureLastMessage(block: ConversationBlock, role: SessionMessage['role']) {
  const last = block.messages.at(-1)

  if (!last || last.role !== role) {
    const msg = {
      id: nanoid(),
      role,
      content: '',
    } as any

    block.messages.push(msg)

    return msg
  }

  return last
}

function ensureLastReasoningMessage(block: ConversationBlock) {
  const last = block.messages.at(-1)

  if (!last || last.role !== 'assistant-reason') {
    const msg: Extract<SessionMessage, { role: 'assistant-reason' }> = {
      id: nanoid(),
      role: 'assistant-reason',
      content: '',
      reasoning: '',
    }

    block.messages.push(msg)

    return msg
  }

  return last
}

function pushMessage(block: ConversationBlock, message: SessionMessage) {
  block.messages.push(message)
}

function createAskUserMessage(question: any): Extract<SessionMessage, { role: 'ask-user' }> {
  return {
    id: nanoid(),
    role: 'ask-user',
    completed: true,
    submitValue: [],
    title: question.title || '',
    description: question.description || '',
    type: question.type === 'multiple' ? 'multiple' : 'single',
    options: Array.isArray(question.options) ? question.options : [],
  }
}

function getCurrentPlanner(state: Session) {
  return state.planner.find((block) => block.id === state.currentPlannerId)
}

function updatePlannerStepStatus(
  planner: Session['planner'][number] | undefined,
  planId: string,
  status: PlanStep['status']
) {
  const step = planner?.plan.find((item) => item.id === planId)
  if (!step) return
  step.status = status
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
