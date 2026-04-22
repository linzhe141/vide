import { nanoid } from 'nanoid'
import type { ConversationBlock, PlanStep, Thread, ThreadMessage, ThreadState } from '.'
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
    case 'workflow-start': {
      const { sessionId, workflowId } = event.data.ctx
      const targetThread = getOrCreateThread(state, sessionId)

      targetThread.blocks.push(createConversationBlock(workflowId, event.data.input))
      targetThread.currentBlockId = workflowId
      return
    }

    case 'workflow-finished':
      if (!block) return
      block.status = 'finished'
      return

    case 'workflow-error':
      console.error(event.data)
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
      block.runtime.streamingReason = false
      block.runtime.streamingText = false
      return

    case 'workflow-llm-reasoning-start':
      if (!block) return
      block.runtime.streamingReason = true
      return

    case 'workflow-llm-reasoning-delta':
      if (!block) return
      ensureLastMessage(block, 'assistant-reason').content += event.data.chunk.delta
      return

    case 'workflow-llm-reasoning-end':
      if (!block) return
      block.runtime.streamingReason = false
      return

    case 'workflow-llm-text-start':
      if (!block) return
      block.runtime.streamingText = true
      return

    case 'workflow-llm-text-delta':
      if (!block) return
      ensureLastMessage(block, 'assistant-text').content += event.data.chunk.delta
      return

    case 'workflow-llm-text-end':
      if (!block) return
      block.runtime.streamingText = false
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
      if (!block) return
      block.runtime.runningToolId = event.data.toolCall.id
      block.runtime.toolStates[event.data.toolCall.id] = {
        status: 'running',
        startedAt: Date.now(),
      }
      return

    case 'workflow-tool-call-success':
      if (!block) return
      block.runtime.runningToolId = undefined
      {
        const prev = block.runtime.toolStates[event.data.toolCallResult.id]
        const finishedAt = Date.now()
        block.runtime.toolStates[event.data.toolCallResult.id] = {
          status: 'success',
          startedAt: prev?.startedAt,
          finishedAt,
          durationMs: prev?.startedAt ? finishedAt - prev.startedAt : undefined,
          result: event.data.toolCallResult.result,
        }
      }
      pushMessage(block, {
        id: nanoid(),
        role: 'tool-result',
        toolCallId: event.data.toolCallResult.id,
        result: event.data.toolCallResult.result,
      })
      return

    case 'workflow-tool-call-error':
      if (!block) return
      {
        const finishedAt = Date.now()
        const toolCallId = event.data.toolCallResult.id || block.runtime.runningToolId
        if (toolCallId) {
          const prev = block.runtime.toolStates[toolCallId]
          block.runtime.toolStates[toolCallId] = {
            status: 'error',
            startedAt: prev?.startedAt,
            finishedAt,
            durationMs: prev?.startedAt ? finishedAt - prev.startedAt : undefined,
            error: event.data.toolCallResult.error,
          }
        }
      }
      block.runtime.runningToolId = undefined
      pushMessage(block, {
        id: nanoid(),
        role: 'error',
        error: event.data.toolCallResult.error,
      })
      return

    case 'ask-user-start-generate':
      if (!block) return
      block.askUser = {
        completed: false,
        submitValue: [],
        title: event.data.title,
        description: event.data.description,
        type: event.data.type,
        options: [],
      }
      return

    case 'ask-user-option':
      if (!block?.askUser) return
      block.askUser.options.push(event.data.option)
      return

    case 'ask-user-complete':
      if (!block?.askUser) return
      block.askUser.completed = true
      return

    case 'planner-start-generate':
      if (!thread) return
      thread.currentPlannerId = event.data.plannerId
      thread.planner.push({
        id: event.data.plannerId,
        plan: [],
      })
      return

    case 'planner-step-generate':
      if (!planner) return
      planner.plan.push(event.data.plan)
      return

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
  const block =
    thread && thread.currentBlockId
      ? thread.blocks.find((item) => item.id === thread.currentBlockId)
      : undefined
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
function createConversationBlock(workflowId: string, input: string): ConversationBlock {
  return {
    id: workflowId,
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
      streamingReason: false,
      streamingText: false,
      waitingHuman: false,
      toolStates: {},
    },
  }
}

function getOrCreateThread(state: ThreadState, sessionId: string) {
  let thread = state.threads.find((item) => item.sessionId === sessionId)
  if (thread) return thread

  thread = {
    sessionId,
    planner: [],
    blocks: [],
    artifacts: [],
  }
  state.threads.push(thread)

  return thread
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

function pushMessage(block: ConversationBlock, message: ThreadMessage) {
  block.messages.push(message)
}

function getCurrentPlanner(state: Thread) {
  return state.planner.find((b) => b.id === state.currentPlannerId)
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
