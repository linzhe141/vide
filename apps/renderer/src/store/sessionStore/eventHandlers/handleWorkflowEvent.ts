import { nanoid } from 'nanoid'
import type {
  Workflow,
  Session,
  AssistantReasonSessionMessage,
  AssistantTextSessionMessage,
  ToolCallSessionMessage,
  AskUserQuestionSessionMessage,
} from '../types'
import { ASK_USER_QUESTION_TOOL_NAME, sanitizeAskUserQuestions } from '../askQuestion'
import type { WorkflowState } from '../../../hooks/useAgentSessionEvent'

export function handleWorkflowEvent(
  storeState: { sessions: Session[] },
  workflowEvent: WorkflowState
) {
  const sessionId = workflowEvent.ctx.sessionId
  const workflowId = workflowEvent.ctx.workflowId
  if (!sessionId || !workflowId) return

  const session = storeState.sessions.find((item) => item.sessionId === sessionId)
  if (!session) return

  // 所有 event 都要记录（不做任何过滤），统一在本函数末尾一次性写入 workflow.events，
  // 保证与后端持久化（WorkflowPersister）写入的事件流完全一致。
  // workflow.start 需要先创建 workflow 再绑定；其余事件挂到已存在的 workflow 上。
  let workflow: Workflow
  if (workflowEvent.type === 'workflow.start') {
    workflow = createWorkflow(workflowId, workflowEvent.input, workflowEvent.inputSource)
    const currentBranch = session.branches.find((item) => item.name === session.activeBranch)
    if (currentBranch) {
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
    }
  } else {
    const existing = session.workflowNodesMap[workflowId]?.workflow
    if (!existing) return
    workflow = existing
  }

  if (workflowEvent.type !== 'workflow.start') {
    switch (workflowEvent.type) {
      case 'workflow.completed': {
        session.runtime.running = false
        workflow.runtime.status = 'finished'
        break
      }

      case 'workflow.interrupted': {
        // ui 还是保持 running 的状态， 但是 workflow 的状态是 interrupted
        session.runtime.running = true
        workflow.runtime.status = 'interrupted'
        break
      }

      case 'workflow.aborted': {
        session.runtime.running = false
        workflow.runtime.status = 'aborted'
        break
      }

      case 'workflow.error': {
        session.runtime.running = false
        workflow.runtime.status = 'error'
        break
      }

      case 'workflow.llm.error': {
        session.runtime.running = false
        workflow.runtime.status = 'error'
        workflow.messages.push({
          id: nanoid(),
          role: 'error',
          error:
            workflowEvent.error instanceof Error
              ? workflowEvent.error.message
              : workflowEvent.error,
        })
        break
      }

      case 'workflow.llm.reason.start': {
        const reasoningMessage = ensureLastMessage(
          session,
          workflowId,
          'assistant-reason'
        ) as AssistantReasonSessionMessage
        reasoningMessage.reasoning = true
        break
      }

      case 'workflow.llm.reason.delta': {
        const reasoningMessage = ensureLastMessage(
          session,
          workflowId,
          'assistant-reason'
        ) as AssistantReasonSessionMessage
        reasoningMessage.content += workflowEvent.chunk.delta
        break
      }

      case 'workflow.llm.reason.end': {
        const reasoningMessage = ensureLastMessage(
          session,
          workflowId,
          'assistant-reason'
        ) as AssistantReasonSessionMessage
        reasoningMessage.reasoning = false
        break
      }

      case 'workflow.llm.text.start': {
        const textMessage = ensureLastMessage(
          session,
          workflowId,
          'assistant-text'
        ) as AssistantTextSessionMessage
        textMessage.streaming = true
        break
      }

      case 'workflow.llm.text.delta': {
        const textMessage = ensureLastMessage(
          session,
          workflowId,
          'assistant-text'
        ) as AssistantTextSessionMessage
        textMessage.content += workflowEvent.chunk.delta
        break
      }

      case 'workflow.llm.text.end': {
        const textMessage = ensureLastMessage(
          session,
          workflowId,
          'assistant-text'
        ) as AssistantTextSessionMessage
        textMessage.streaming = false
        break
      }

      case 'workflow.llm.tool.call.end': {
        const askQuestionToolCalls = workflowEvent.toolCall.filter(
          (toolCall) => toolCall.function.name === ASK_USER_QUESTION_TOOL_NAME
        )
        if (askQuestionToolCalls.length) {
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
        }

        const normalToolCalls = workflowEvent.toolCall.filter(
          (toolCall) => toolCall.function.name !== ASK_USER_QUESTION_TOOL_NAME
        )
        if (normalToolCalls.length) {
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

  // 统一入口：所有 event 原样记录，与持久化数据完全一致（不做任何过滤）。
  workflow.events ??= []
  workflow.events.push({
    id: nanoid(),
    type: workflowEvent.type,
    createdAt: Date.now(),
    payload: sanitizeWorkflowEventPayload(workflowEvent),
  })
}

function createWorkflow(
  workflowId: string,
  input: string,
  inputSource: 'desktop' | 'wechat-bot'
): Workflow {
  const newWorkflow: Workflow = {
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
  return newWorkflow
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
