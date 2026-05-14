import { nanoid } from 'nanoid'
import { ASK_USER_TOOL_NAMES } from '@/agent/core/tools/askUserQuestion'
import type {
  ConversationBlock,
  PlanStep,
  SessionBranch,
  Thread,
  ThreadMessage,
  ThreadState,
} from '.'
import type { WorkflowState } from '../../hooks/createWorkflowStream'

type ThreadEventContext = {
  state: ThreadState
  sessionId?: string
  thread?: Thread
  block?: ConversationBlock
  planner?: Thread['planner'][number]
  event: WorkflowState
}

export function handleWorkflowEvent(storeState: ThreadState, workflowEvent: WorkflowState) {
  const context = createThreadEventContext(storeState, workflowEvent)
  const { event, state, thread, block, planner } = context

  switch (event.type) {
    case 'agent-create-session': {
      getOrCreateThread(state, event.data.sessionId, event.data.activeBranch)
      return
    }

    case 'agent-session-forked': {
      if (!thread) return
      upsertBranch(thread, {
        name: event.data.branchName,
        headBlockId: event.data.sourceWorkflowId,
      })
      thread.activeBranch = event.data.branchName
      thread.currentBlockId = event.data.sourceWorkflowId || undefined
      return
    }

    case 'workflow-start': {
      const { sessionId, workflowId, parentWorkflowId, branchName } = event.data.ctx
      const targetThread = getOrCreateThread(state, sessionId, branchName)
      const createdBlock = createConversationBlock(workflowId, event.data.input, parentWorkflowId)

      targetThread.blockMap[workflowId] = createdBlock
      if (!targetThread.blockOrder.includes(workflowId)) {
        targetThread.blockOrder.push(workflowId)
      }
      if (parentWorkflowId) {
        const parentBlock = targetThread.blockMap[parentWorkflowId]
        if (parentBlock && !parentBlock.childBlockIds.includes(workflowId)) {
          parentBlock.childBlockIds.push(workflowId)
        }
      }
      targetThread.currentBlockId = workflowId
      targetThread.activeBranch = branchName
      upsertBranch(targetThread, {
        name: branchName,
        headBlockId: workflowId,
      })
      return
    }

    case 'workflow-finished':
      if (!block) return
      block.status = 'finished'
      return

    case 'workflow-error':
      if (!block) return
      block.status = 'error'
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
      if (!thread) return
      thread.currentPlannerId = event.data.plannerId
      thread.planner.push({
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

function createThreadEventContext(state: ThreadState, event: WorkflowState): ThreadEventContext {
  const sessionId = getEventSessionId(event)
  const thread = sessionId ? state.threads.find((item) => item.sessionId === sessionId) : undefined
  const workflowId = 'ctx' in event.data ? event.data.ctx.workflowId : undefined
  const block = workflowId && thread ? thread.blockMap[workflowId] : undefined
  const planner = thread ? getCurrentPlanner(thread) : undefined

  return {
    state,
    sessionId,
    thread,
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

function getOrCreateThread(state: ThreadState, sessionId: string, activeBranch: string) {
  let thread = state.threads.find((item) => item.sessionId === sessionId)
  if (thread) return thread

  thread = {
    sessionId,
    activeBranch,
    branches: [{ name: activeBranch, headBlockId: null }],
    planner: [],
    blockMap: {},
    blockOrder: [],
    artifacts: [],
  }
  state.threads.push(thread)

  return thread
}

function upsertBranch(thread: Thread, branch: SessionBranch) {
  const target = thread.branches.find((item) => item.name === branch.name)
  if (target) {
    target.headBlockId = branch.headBlockId
    return
  }
  thread.branches.push(branch)
}

function ensureLastMessage(block: ConversationBlock, role: ThreadMessage['role']) {
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
    const msg: Extract<ThreadMessage, { role: 'assistant-reason' }> = {
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

function pushMessage(block: ConversationBlock, message: ThreadMessage) {
  block.messages.push(message)
}

function createAskUserMessage(question: any): Extract<ThreadMessage, { role: 'ask-user' }> {
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

function getCurrentPlanner(state: Thread) {
  return state.planner.find((block) => block.id === state.currentPlannerId)
}

function updatePlannerStepStatus(
  planner: Thread['planner'][number] | undefined,
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
