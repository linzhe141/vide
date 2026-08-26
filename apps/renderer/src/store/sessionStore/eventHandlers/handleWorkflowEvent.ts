import { uuid as nanoid } from '@/lib/uuid'
import type { WorkflowEvent } from '@vide/agent/event'
import type {
  Workflow,
  Session,
  AssistantReasonSessionMessage,
  AssistantTextSessionMessage,
  ToolCallSessionMessage,
  AskUserQuestionSessionMessage,
  WorkflowSessionMessage,
} from '../types'
import { ASK_USER_QUESTION_TOOL_NAME, sanitizeAskUserQuestions } from '../askQuestion'
import type { WorkflowState } from '../../../hooks/useAgentSessionEvent'

type WorkflowEventContext = WorkflowState['ctx'] & {
  namespace?: string | null
  mainWorkflowId?: string | null
}

type WorkflowEventWithContext = WorkflowEvent & {
  ctx: WorkflowEventContext
}

type NestedWorkflowEvent = WorkflowEventWithContext

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

  if (workflowEvent.type === 'workflow.custom') {
    handleCustomWorkflowEvent(workflow, workflowEvent, session)
  } else {
    applyWorkflowEventToWorkflow(workflow, workflowEvent, session, true)
  }

  recordWorkflowEvent(workflow, workflowEvent)
}

function ensureRootWorkflow(
  session: Session,
  workflowId: string,
  workflowEvent: WorkflowState
): Workflow | undefined {
  if (workflowEvent.type === 'workflow.start') {
    const workflow = createWorkflow(workflowId, workflowEvent.input, workflowEvent.inputSource)
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

function handleCustomWorkflowEvent(
  workflow: Workflow,
  workflowEvent: Extract<WorkflowState, { type: 'workflow.custom' }>,
  session: Session
) {
  if (workflowEvent.eventName !== 'sub-agent.event') {
    return
  }

  const nestedEvent = toNestedWorkflowEvent(workflowEvent.data)
  if (!nestedEvent?.ctx.workflowId) {
    return
  }

  const nestedWorkflow = ensureNestedWorkflow(workflow, nestedEvent)
  if (!nestedWorkflow) {
    return
  }

  applyWorkflowEventToWorkflow(nestedWorkflow, nestedEvent, session, false)
  recordWorkflowEvent(nestedWorkflow, nestedEvent)
}

function applyWorkflowEventToWorkflow(
  workflow: Workflow,
  workflowEvent: WorkflowEventWithContext,
  session: Session,
  isRootWorkflow: boolean
) {
  if (workflowEvent.type === 'workflow.start') {
    return
  }

  switch (workflowEvent.type) {
    case 'workflow.completed': {
      if (isRootWorkflow) {
        session.runtime.running = false
      }
      workflow.runtime.status = 'finished'
      break
    }

    case 'workflow.interrupted': {
      if (isRootWorkflow) {
        session.runtime.running = true
      }
      workflow.runtime.status = 'interrupted'
      break
    }

    case 'workflow.aborted': {
      if (isRootWorkflow) {
        session.runtime.running = false
      }
      workflow.runtime.status = 'aborted'
      break
    }

    case 'workflow.error': {
      if (isRootWorkflow) {
        session.runtime.running = false
      }
      workflow.runtime.status = 'error'
      break
    }

    case 'workflow.llm.error': {
      if (isRootWorkflow) {
        session.runtime.running = false
      }
      workflow.runtime.status = 'error'
      workflow.messages.push({
        id: nanoid(),
        role: 'error',
        error:
          workflowEvent.error instanceof Error ? workflowEvent.error.message : workflowEvent.error,
      })
      break
    }

    case 'workflow.llm.reason.start': {
      const reasoningMessage = ensureLastMessageOnWorkflow(
        workflow,
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      reasoningMessage.reasoning = true
      break
    }

    case 'workflow.llm.reason.delta': {
      const reasoningMessage = ensureLastMessageOnWorkflow(
        workflow,
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      reasoningMessage.content += workflowEvent.chunk.delta
      break
    }

    case 'workflow.llm.reason.end': {
      const reasoningMessage = ensureLastMessageOnWorkflow(
        workflow,
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      reasoningMessage.reasoning = false
      break
    }

    case 'workflow.llm.text.start': {
      const textMessage = ensureLastMessageOnWorkflow(
        workflow,
        'assistant-text'
      ) as AssistantTextSessionMessage
      textMessage.streaming = true
      break
    }

    case 'workflow.llm.text.delta': {
      const textMessage = ensureLastMessageOnWorkflow(
        workflow,
        'assistant-text'
      ) as AssistantTextSessionMessage
      textMessage.content += workflowEvent.chunk.delta
      break
    }

    case 'workflow.llm.text.end': {
      const textMessage = ensureLastMessageOnWorkflow(
        workflow,
        'assistant-text'
      ) as AssistantTextSessionMessage
      textMessage.streaming = false
      break
    }

    case 'workflow.llm.tool.call.end': {
      const askQuestionToolCalls = workflowEvent.toolCall.filter(
        (toolCall) => toolCall.function.name === ASK_USER_QUESTION_TOOL_NAME
      )
      for (const toolCall of askQuestionToolCalls) {
        const args = parseToolArguments(toolCall.function.arguments)
        const questions = sanitizeAskUserQuestions(args?.questions)
        if (!questions.length) continue

        const askUserQuestionMessage: AskUserQuestionSessionMessage = {
          id: nanoid(),
          role: 'ask-user-question',
          toolCallId: toolCall.id,
          questions,
        }
        workflow.messages.push(askUserQuestionMessage)
      }

      const normalToolCalls = workflowEvent.toolCall.filter(
        (toolCall) => toolCall.function.name !== ASK_USER_QUESTION_TOOL_NAME
      )
      if (normalToolCalls.length > 0) {
        const toolCallMessage: ToolCallSessionMessage = {
          id: nanoid(),
          role: 'tool-call',
          toolCalls: normalToolCalls.map((toolCall) => ({ toolCall })),
        }
        workflow.messages.push(toolCallMessage)
      }
      break
    }

    case 'workflow.tool.call.start':
      break

    case 'workflow.tool.call.success': {
      const toolCallState = findToolCallState(workflow, workflowEvent.toolCallResult.id)
      if (toolCallState) {
        toolCallState.result = {
          status: 'success',
          result: workflowEvent.toolCallResult.result,
          startedAt: workflowEvent.toolCallResult.startedAt,
          finishedAt: workflowEvent.toolCallResult.finishedAt,
          durationMs: workflowEvent.toolCallResult.durationMs,
        }
      }
      break
    }

    case 'workflow.tool.call.error': {
      const toolCallState = findToolCallState(workflow, workflowEvent.toolCallResult.id)
      if (toolCallState) {
        toolCallState.result = {
          status: 'error',
          error: workflowEvent.toolCallResult.error,
        }
      }
      break
    }

    default:
      break
  }
}

function createWorkflow(
  workflowId: string,
  input: string,
  inputSource: 'desktop' | 'wechat-bot'
): Workflow {
  return {
    id: workflowId,
    input,
    inputSource,
    feedback: null,
    events: [],
    messages: [
      {
        id: nanoid(),
        role: 'user',
        content: input,
      },
    ],
    runtime: {
      status: 'running',
    },
  }
}

function ensureNestedWorkflow(
  mainWorkflow: Workflow,
  workflowEvent: NestedWorkflowEvent
): WorkflowSessionMessage | undefined {
  const nestedWorkflowId = workflowEvent.ctx.workflowId
  if (!nestedWorkflowId) {
    return undefined
  }

  const existing = findNestedWorkflow(mainWorkflow, nestedWorkflowId)
  if (existing) {
    mainWorkflow.subWorkflow = existing
    return existing
  }

  if (workflowEvent.type !== 'workflow.start') {
    return undefined
  }

  const nestedWorkflow: WorkflowSessionMessage = {
    role: 'workflow',
    ...createWorkflow(nestedWorkflowId, workflowEvent.input, workflowEvent.inputSource),
  }
  mainWorkflow.messages.push(nestedWorkflow)
  mainWorkflow.subWorkflow = nestedWorkflow
  return nestedWorkflow
}

function findNestedWorkflow(
  mainWorkflow: Workflow,
  nestedWorkflowId: string
): WorkflowSessionMessage | undefined {
  return mainWorkflow.messages.find(
    (message): message is WorkflowSessionMessage =>
      message.role === 'workflow' && message.id === nestedWorkflowId
  )
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

function ensureLastMessageOnWorkflow(
  workflow: Workflow,
  role: 'assistant-reason' | 'assistant-text'
) {
  const last = workflow.messages.at(-1)
  if (last?.role === role) {
    return last
  }

  if (role === 'assistant-reason') {
    const message: AssistantReasonSessionMessage = {
      id: nanoid(),
      role,
      content: '',
      reasoning: false,
    }
    workflow.messages.push(message)
    return message
  }

  const message: AssistantTextSessionMessage = {
    id: nanoid(),
    role,
    content: '',
    streaming: false,
  }
  workflow.messages.push(message)
  return message
}

function findToolCallState(workflow: Workflow, toolCallId: string) {
  for (let index = workflow.messages.length - 1; index >= 0; index -= 1) {
    const message = workflow.messages[index]
    if (message.role !== 'tool-call') continue
    const toolCallState = message.toolCalls.find((item) => item.toolCall.id === toolCallId)
    if (toolCallState) return toolCallState
  }
  return undefined
}

function parseToolArguments(argumentsText: string) {
  try {
    return JSON.parse(argumentsText) as Record<string, unknown>
  } catch {
    return null
  }
}

function toNestedWorkflowEvent(data: unknown): NestedWorkflowEvent | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const candidate = data as Partial<NestedWorkflowEvent>
  if (!candidate.type || !candidate.ctx || typeof candidate.ctx !== 'object') {
    return null
  }

  return candidate as NestedWorkflowEvent
}
