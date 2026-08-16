import { nanoid } from 'nanoid'
import type {
  Workflow,
  Session,
  AssistantReasonSessionMessage,
  AssistantTextSessionMessage,
  ToolCallSessionMessage,
  AskQuestionOption,
  AskUserQuestionSessionMessage,
} from '../types'
import type { WorkflowState } from '../../../hooks/createWorkflowStream'

export function handleWorkflowEvent(
  storeState: { sessions: Session[] },
  workflowEvent: WorkflowState
) {
  const sessionId = workflowEvent.ctx.sessionId
  const workflowId = workflowEvent.ctx.workflowId
  if (!sessionId || !workflowId) return

  const session = storeState.sessions.find((item) => item.sessionId === sessionId)
  if (!session) return

  switch (workflowEvent.type) {
    case 'workflow.start': {
      const newWorkflow = createWorkflow(workflowId, workflowEvent.input)
      appendWorkflowLogEvent(newWorkflow, workflowEvent)
      const currentBranch = session.branches.find((item) => item.name === session.activeBranch)
      if (!currentBranch) return

      const parentId = currentBranch.headWorkflowId
      session.workflowNodesMap[newWorkflow.id] = {
        workflow: newWorkflow,
        children: [],
        parent: parentId,
      }
      if (parentId && session.workflowNodesMap[parentId]) {
        session.workflowNodesMap[parentId].children.push(newWorkflow.id)
      }
      currentBranch.headWorkflowId = newWorkflow.id
      session.runtime.running = true
      return
    }

    case 'workflow.completed': {
      session.runtime.running = false
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)
      workflow.runtime.status = 'finished'
      return
    }

    case 'workflow.interrupted': {
      // ui 还是保持 running 的状态， 但是 workflow 的状态是 interrupted
      session.runtime.running = true
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)
      workflow.runtime.status = 'interrupted'
      return
    }

    case 'workflow.aborted': {
      session.runtime.running = false
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)
      workflow.runtime.status = 'aborted'

      return
    }

    case 'workflow.error': {
      session.runtime.running = false
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)
      workflow.runtime.status = 'error'
      return
    }

    case 'workflow.llm.error': {
      session.runtime.running = false
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)
      workflow.runtime.status = 'error'

      workflow.messages.push({
        id: nanoid(),
        role: 'error',
        error:
          workflowEvent.error instanceof Error ? workflowEvent.error.message : workflowEvent.error,
      })
      return
    }

    case 'workflow.llm.reason.start': {
      const reasoningMessage = ensureLastMessage(
        session,
        workflowId,
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      appendWorkflowLogEvent(session.workflowNodesMap[workflowId].workflow, workflowEvent)
      reasoningMessage.reasoning = true
      return
    }

    case 'workflow.llm.reason.delta': {
      const reasoningMessage = ensureLastMessage(
        session,
        workflowId,
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      appendWorkflowLogEvent(session.workflowNodesMap[workflowId].workflow, workflowEvent)
      reasoningMessage.content += workflowEvent.chunk.delta
      return
    }

    case 'workflow.llm.reason.end': {
      const reasoningMessage = ensureLastMessage(
        session,
        workflowId,
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      appendWorkflowLogEvent(session.workflowNodesMap[workflowId].workflow, workflowEvent)
      reasoningMessage.reasoning = false
      return
    }

    case 'workflow.llm.text.start': {
      const textMessage = ensureLastMessage(
        session,
        workflowId,
        'assistant-text'
      ) as AssistantTextSessionMessage
      appendWorkflowLogEvent(session.workflowNodesMap[workflowId].workflow, workflowEvent)
      textMessage.streaming = true
      return
    }

    case 'workflow.llm.text.delta': {
      const textMessage = ensureLastMessage(
        session,
        workflowId,
        'assistant-text'
      ) as AssistantTextSessionMessage
      appendWorkflowLogEvent(session.workflowNodesMap[workflowId].workflow, workflowEvent)
      textMessage.content += workflowEvent.chunk.delta
      return
    }

    case 'workflow.llm.text.end': {
      const textMessage = ensureLastMessage(
        session,
        workflowId,
        'assistant-text'
      ) as AssistantTextSessionMessage
      appendWorkflowLogEvent(session.workflowNodesMap[workflowId].workflow, workflowEvent)
      textMessage.streaming = false
      return
    }

    case 'workflow.llm.tool.call.end': {
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)

      const askQuestionToolCalls = workflowEvent.toolCall.filter(
        (toolCall) => toolCall.function.name === 'ask-user-question-generate'
      )
      if (askQuestionToolCalls.length) {
        for (const toolCall of askQuestionToolCalls) {
          const args = parseToolArguments(toolCall.function.arguments)
          const title = typeof args?.title === 'string' ? args.title.trim() : ''
          const description = typeof args?.description === 'string' ? args.description.trim() : ''
          const options = sanitizeAskQuestionOptions(args?.options)
          if (!title || !options.length) continue

          const askUserQuestionMessage: AskUserQuestionSessionMessage = {
            id: nanoid(),
            role: 'ask-user-question',
            toolCallId: toolCall.id,
            title,
            description: description || undefined,
            options,
            answer: null,
          }
          workflow.messages.push(askUserQuestionMessage)
        }
      }

      const normalToolCalls = workflowEvent.toolCall.filter(
        (toolCall) => toolCall.function.name !== 'ask-user-question-generate'
      )
      if (!normalToolCalls.length) return

      const toolCallMessage: ToolCallSessionMessage = {
        id: nanoid(),
        role: 'tool-call',
        toolCalls: normalToolCalls.map((toolCall) => ({ toolCall })),
      }
      workflow.messages.push(toolCallMessage)
      return
    }

    case 'workflow.tool.call.start': {
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)
      return
    }

    case 'workflow.tool.call.success': {
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)

      const toolCallState = findToolCallState(workflow, workflowEvent.toolCallResult.id)
      if (!toolCallState) return
      toolCallState.result = {
        status: 'success',
        result: workflowEvent.toolCallResult.result,
        startedAt: workflowEvent.toolCallResult.startedAt,
        finishedAt: workflowEvent.toolCallResult.finishedAt,
        durationMs: workflowEvent.toolCallResult.durationMs,
      }
      return
    }

    case 'workflow.tool.call.error': {
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)

      const toolCallState = findToolCallState(workflow, workflowEvent.toolCallResult.id)
      if (!toolCallState) return
      toolCallState.result = {
        status: 'error',
        error: workflowEvent.toolCallResult.error,
      }
      return
    }

    case 'workflow.step.start':
    case 'workflow.step.end':
    case 'workflow.llm.start':
    case 'workflow.llm.tool.call.process':
    case 'workflow.llm.end':
    case 'workflow.llm.result': {
      const workflow = session.workflowNodesMap[workflowId]?.workflow
      if (!workflow) return
      appendWorkflowLogEvent(workflow, workflowEvent)
      return
    }

    default:
      return
  }
}

function createWorkflow(workflowId: string, input: string): Workflow {
  const newWorkflow: Workflow = {
    id: workflowId,
    input,
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
  return newWorkflow
}

function appendWorkflowLogEvent(workflow: Workflow, workflowEvent: WorkflowState) {
  if (
    workflowEvent.type === 'workflow.llm.reason.delta' ||
    workflowEvent.type === 'workflow.llm.text.delta'
  ) {
    return
  }

  workflow.events ??= []
  workflow.events.push({
    id: nanoid(),
    type: workflowEvent.type,
    createdAt: Date.now(),
    payload: sanitizeWorkflowEventPayload(workflowEvent),
  })
}

function sanitizeWorkflowEventPayload(workflowEvent: WorkflowState) {
  const { ctx: _ctx, ...payload } = workflowEvent
  return payload
}

function ensureLastMessage(
  session: Session,
  workflowId: string,
  role: 'assistant-reason' | 'assistant-text'
) {
  const workflow = session.workflowNodesMap[workflowId]?.workflow
  if (!workflow) throw new Error('No workflow found for this event, this is a internal error')
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
  for (let i = workflow.messages.length - 1; i >= 0; i--) {
    const message = workflow.messages[i]
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

function sanitizeAskQuestionOptions(options: unknown): AskQuestionOption[] {
  if (!Array.isArray(options)) return []

  const normalized = options
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const label =
        typeof (item as { label?: unknown }).label === 'string'
          ? (item as { label: string }).label.trim()
          : ''
      const value =
        typeof (item as { value?: unknown }).value === 'string'
          ? (item as { value: string }).value.trim()
          : ''
      if (!label || !value) return null
      return { label, value }
    })
    .filter((item): item is AskQuestionOption => item !== null)

  return normalized
}
