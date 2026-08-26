import { uuid as nanoid } from '@/lib/uuid'
import type { AgentMessage, ToolCall } from '@vide/ai'
import type { WorkflowEvent } from '@vide/agent/event'
import type { SessionDataDto, SessionWorkflowData, WorkflowLogDto } from '@vide/config'
import type {
  AssistantReasonSessionMessage,
  AssistantTextSessionMessage,
  Session,
  SessionBranch,
  SessionMessage,
  ToolCallState,
  Workflow,
  WorkflowLogEvent,
  WorkflowSessionMessage,
  WorkflowNode,
} from './types'
import { ASK_USER_QUESTION_TOOL_NAME, sanitizeAskUserQuestions } from './askQuestion'

type WorkflowEventContext = {
  sessionId: string | null
  workflowId: string | null
  namespace?: string | null
  mainWorkflowId?: string | null
}

type WorkflowEventWithContext = WorkflowEvent & {
  ctx: WorkflowEventContext
}

/**
 * 依据 SQLite 持久化的 session data 派生前端 UI 态：
 * - workflow message 主要只根据持久化的 agent messages 还原；
 * - workflow logs 保留给日志面板展示，不参与 ask-question / user message 的位置派生；
 * - 少量跨 workflow 规则（如 ask-question 的答案 input）在前端按需解释。
 */
export function buildSessionFromData(data: SessionDataDto): Session {
  const workflowNodesMap: Record<string, WorkflowNode> = {}
  const branches: SessionBranch[] = []

  for (const wf of data.workflows) {
    const workflow = buildWorkflow(wf)
    const node: WorkflowNode = {
      workflow,
      parent: wf.parentWorkflowId,
      children: data.workflows.filter((w) => w.parentWorkflowId === wf.id).map((w) => w.id),
    }
    workflowNodesMap[wf.id] = node
  }

  for (const branch of data.branches) {
    branches.push({
      name: branch.name,
      headWorkflowId: branch.headWorkflowId,
      sourceWorkflowId: branch.sourceWorkflowId,
    })
  }

  const activeBranch = branches.find((b) => b.name === data.activeBranch)
  const headId = activeBranch?.headWorkflowId ?? null
  const running = !!headId && workflowNodesMap[headId]?.workflow.runtime.status === 'running'

  return {
    sessionId: data.id,
    sessionSource: data.sessionSource,
    autoApprove: data.autoApprove,
    thinkingMode: data.thinkingMode,
    workspacePath: data.workspacePath,
    activeBranch: data.activeBranch,
    branches,
    workflowNodesMap,
    runtime: { running },
  }
}

function buildWorkflow(wf: SessionWorkflowData): Workflow {
  const decoded = decodeAgentMessages(wf.agentMessages)

  let runtimeStatus: Workflow['runtime']['status']
  switch (wf.stopStatus) {
    case 'completed':
      runtimeStatus = 'finished'
      break
    case 'aborted':
      runtimeStatus = 'aborted'
      break
    case 'error':
      runtimeStatus = 'error'
      break
    case 'interrupted':
      runtimeStatus = 'interrupted'
      break
    default:
      runtimeStatus = 'running'
  }

  const workflow: Workflow = {
    id: wf.id,
    input: wf.input,
    inputSource: wf.inputSource,
    feedback: wf.feedback,
    events: buildLogEvents(wf.logs),
    messages: buildMessages(decoded, wf),
    runtime: { status: runtimeStatus },
  }

  restoreNestedWorkflowsFromLogs(workflow, wf.logs)

  return workflow
}

function decodeAgentMessages(
  rows: SessionWorkflowData['agentMessages']
): { message: AgentMessage; createdAt: number }[] {
  const result: { message: AgentMessage; createdAt: number }[] = []
  for (const row of rows) {
    if (!row.payload) continue
    try {
      result.push({ message: JSON.parse(row.payload) as AgentMessage, createdAt: row.createdAt })
    } catch {
      // 忽略无法解析的行
    }
  }
  return result
}

function buildLogEvents(logs: WorkflowLogDto[]): WorkflowLogEvent[] {
  return logs.map((log) => {
    let payload: unknown = undefined
    if (log.payload) {
      try {
        payload = JSON.parse(log.payload)
      } catch {
        payload = log.payload
      }
    }
    return {
      id: log.id,
      type: log.eventName,
      createdAt: log.createdAt,
      payload,
    }
  })
}

/** 依据 agent messages 派生 UI 的 SessionMessage[]。 */
function buildMessages(
  agentMessages: { message: AgentMessage; createdAt: number }[],
  workflow: SessionWorkflowData
): SessionMessage[] {
  const messages: SessionMessage[] = []
  const deferredAskQuestionMessages: SessionMessage[] = []
  const toolCallStates = new Map<string, ToolCallState>()
  const restoredToolResults = buildToolCallResultMap(workflow.logs)

  const scrollInto = <T extends SessionMessage>(m: T): T => {
    messages.push(m)
    return m
  }

  for (const { message } of agentMessages) {
    switch (message.role) {
      case 'user': {
        scrollInto({
          id: nanoid(),
          role: 'user',
          content: String(message.content ?? ''),
        })
        break
      }
      case 'assistant': {
        const content = typeof message.content === 'string' ? message.content : ''
        if (content) {
          scrollInto({ id: nanoid(), role: 'assistant-text', content, streaming: false })
        }
        const toolCalls = message.tool_calls ?? []
        if (toolCalls.length) {
          const states: ToolCallState[] = []
          for (const tc of toolCalls) {
            const toolCall: ToolCall = {
              id: tc.id,
              type: 'function',
              function: {
                name:
                  (tc as { function?: { name: string; arguments: string } }).function?.name ?? '',
                arguments:
                  (tc as { function?: { name: string; arguments: string } }).function?.arguments ??
                  '',
              },
              status: 'auto-approved',
            }
            // ask-user-question 生成独立的提问卡片，不进入通用 tool-call 卡片。
            // （卡片是否只读由 active branch 是否存在「下一个 workflow」决定，见 MessageList。）
            if (toolCall.function.name === ASK_USER_QUESTION_TOOL_NAME) {
              const questions = sanitizeAskUserQuestions(
                parseToolArguments(toolCall.function.arguments)?.questions
              )
              if (questions.length) {
                deferredAskQuestionMessages.push({
                  id: nanoid(),
                  role: 'ask-user-question',
                  toolCallId: toolCall.id,
                  questions,
                })
              }
              continue
            }
            const state: ToolCallState = {
              toolCall,
              result: restoredToolResults.get(tc.id),
            }
            toolCallStates.set(tc.id, state)
            states.push(state)
          }
          if (states.length) {
            scrollInto({ id: nanoid(), role: 'tool-call', toolCalls: states })
          }
        }

        break
      }
      case 'tool': {
        const toolMsg = message as {
          role: 'tool'
          content?: AgentMessage['content']
          tool_call_id?: string
        }
        const state = toolCallStates.get(toolMsg.tool_call_id ?? '')
        if (state && !state.result) {
          let parsed = message.content
          if (typeof message.content === 'string') {
            try {
              parsed = JSON.parse(message.content)
            } catch {
              /* keep raw */
            }
          }
          state.result = {
            status: 'success',
            result: {
              reason: 'call-llm',
              result: parsed,
            },
          }
        }
        break
      }
      case 'system':
      case 'context':
      default:
        // 不在 UI 展示
        break
    }
  }

  // ask-question 在 workflow 语义上应停在最后，提交会进入下一个 workflow。
  messages.push(...deferredAskQuestionMessages)

  return messages
}

function restoreNestedWorkflowsFromLogs(workflow: Workflow, logs: WorkflowLogDto[]) {
  for (const log of logs) {
    if (log.eventName !== 'workflow.custom') {
      continue
    }

    const payload = parseWorkflowLogPayload(log.payload)
    if (!isSubAgentCustomEventPayload(payload)) {
      continue
    }

    const nestedEvent = toWorkflowEventWithContext(payload.data)
    if (!nestedEvent?.ctx.workflowId) {
      continue
    }

    const nestedWorkflow = ensureNestedWorkflowFromEvent(workflow, nestedEvent)
    if (!nestedWorkflow) {
      continue
    }

    applyNestedWorkflowEvent(nestedWorkflow, nestedEvent)
    nestedWorkflow.events ??= []
    nestedWorkflow.events.push({
      id: nanoid(),
      type: nestedEvent.type,
      createdAt: log.createdAt,
      payload: sanitizeWorkflowEventPayload(nestedEvent),
    })
  }
}

/** 解析 tool call 的 arguments JSON。 */
function parseToolArguments(argumentsText: string): Record<string, unknown> | null {
  try {
    return JSON.parse(argumentsText) as Record<string, unknown>
  } catch {
    return null
  }
}

function buildToolCallResultMap(logs: WorkflowLogDto[]): Map<string, ToolCallState['result']> {
  const results = new Map<string, ToolCallState['result']>()

  for (const log of logs) {
    const payload = parseWorkflowLogPayload(log.payload)
    if (!payload || typeof payload !== 'object') continue

    if (log.eventName === 'workflow.tool.call.success') {
      const toolCallResult = (payload as { toolCallResult?: unknown }).toolCallResult
      if (!isToolCallSuccessPayload(toolCallResult)) continue
      results.set(toolCallResult.id, {
        status: 'success',
        result: toolCallResult.result,
        startedAt: toolCallResult.startedAt,
        finishedAt: toolCallResult.finishedAt,
        durationMs: toolCallResult.durationMs,
      })
      continue
    }

    if (log.eventName === 'workflow.tool.call.error') {
      const toolCallResult = (payload as { toolCallResult?: unknown }).toolCallResult
      if (!isToolCallErrorPayload(toolCallResult)) continue
      results.set(toolCallResult.id, {
        status: 'error',
        error: toolCallResult.error,
      })
    }
  }

  return results
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

function ensureNestedWorkflowFromEvent(
  workflow: Workflow,
  event: WorkflowEventWithContext
): WorkflowSessionMessage | undefined {
  const nestedWorkflowId = event.ctx.workflowId
  if (!nestedWorkflowId) {
    return undefined
  }

  const existing = workflow.messages.find(
    (message): message is WorkflowSessionMessage =>
      message.role === 'workflow' && message.id === nestedWorkflowId
  )
  if (existing) {
    workflow.subWorkflow = existing
    return existing
  }

  if (event.type !== 'workflow.start') {
    return undefined
  }

  const nestedWorkflow: WorkflowSessionMessage = {
    role: 'workflow',
    id: nestedWorkflowId,
    input: event.input,
    inputSource: event.inputSource,
    feedback: null,
    events: [],
    messages: [
      {
        id: nanoid(),
        role: 'user',
        content: event.input,
      },
    ],
    runtime: {
      status: 'running',
    },
  }
  workflow.messages.push(nestedWorkflow)
  workflow.subWorkflow = nestedWorkflow
  return nestedWorkflow
}

function applyNestedWorkflowEvent(workflow: Workflow, event: WorkflowEventWithContext) {
  if (event.type === 'workflow.start') {
    return
  }

  switch (event.type) {
    case 'workflow.completed': {
      workflow.runtime.status = 'finished'
      break
    }

    case 'workflow.interrupted': {
      workflow.runtime.status = 'interrupted'
      break
    }

    case 'workflow.aborted': {
      workflow.runtime.status = 'aborted'
      break
    }

    case 'workflow.error': {
      workflow.runtime.status = 'error'
      break
    }

    case 'workflow.llm.error': {
      workflow.runtime.status = 'error'
      workflow.messages.push({
        id: nanoid(),
        role: 'error',
        error: event.error,
      })
      break
    }

    case 'workflow.llm.reason.start': {
      const reasoningMessage = ensureWorkflowTailMessage(workflow, 'assistant-reason')
      reasoningMessage.reasoning = true
      break
    }

    case 'workflow.llm.reason.delta': {
      const reasoningMessage = ensureWorkflowTailMessage(workflow, 'assistant-reason')
      reasoningMessage.content += event.chunk.delta
      break
    }

    case 'workflow.llm.reason.end': {
      const reasoningMessage = ensureWorkflowTailMessage(workflow, 'assistant-reason')
      reasoningMessage.reasoning = false
      break
    }

    case 'workflow.llm.text.start': {
      const textMessage = ensureWorkflowTailMessage(workflow, 'assistant-text')
      textMessage.streaming = true
      break
    }

    case 'workflow.llm.text.delta': {
      const textMessage = ensureWorkflowTailMessage(workflow, 'assistant-text')
      textMessage.content += event.chunk.delta
      break
    }

    case 'workflow.llm.text.end': {
      const textMessage = ensureWorkflowTailMessage(workflow, 'assistant-text')
      textMessage.streaming = false
      break
    }

    case 'workflow.llm.tool.call.end': {
      const askQuestionToolCalls = event.toolCall.filter(
        (toolCall) => toolCall.function.name === ASK_USER_QUESTION_TOOL_NAME
      )
      for (const toolCall of askQuestionToolCalls) {
        const args = parseToolArguments(toolCall.function.arguments)
        const questions = sanitizeAskUserQuestions(args?.questions)
        if (!questions.length) continue

        workflow.messages.push({
          id: nanoid(),
          role: 'ask-user-question',
          toolCallId: toolCall.id,
          questions,
        })
      }

      const visibleToolCalls = event.toolCall.filter(
        (toolCall) => toolCall.function.name !== ASK_USER_QUESTION_TOOL_NAME
      )
      if (visibleToolCalls.length > 0) {
        workflow.messages.push({
          id: nanoid(),
          role: 'tool-call',
          toolCalls: visibleToolCalls.map((toolCall) => ({ toolCall })),
        })
      }
      break
    }

    case 'workflow.tool.call.success': {
      const toolCallState = findToolCallState(workflow, event.toolCallResult.id)
      if (toolCallState) {
        toolCallState.result = {
          status: 'success',
          result: event.toolCallResult.result,
          startedAt: event.toolCallResult.startedAt,
          finishedAt: event.toolCallResult.finishedAt,
          durationMs: event.toolCallResult.durationMs,
        }
      }
      break
    }

    case 'workflow.tool.call.error': {
      const toolCallState = findToolCallState(workflow, event.toolCallResult.id)
      if (toolCallState) {
        toolCallState.result = {
          status: 'error',
          error: event.toolCallResult.error,
        }
      }
      break
    }

    default:
      break
  }
}

function parseWorkflowLogPayload(payload: string | null): unknown {
  if (!payload) return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function sanitizeWorkflowEventPayload(workflowEvent: WorkflowEventWithContext) {
  const { ctx: _ctx, ...payload } = workflowEvent
  return payload
}

function ensureWorkflowTailMessage(
  workflow: Workflow,
  role: 'assistant-reason'
): AssistantReasonSessionMessage
function ensureWorkflowTailMessage(
  workflow: Workflow,
  role: 'assistant-text'
): AssistantTextSessionMessage
function ensureWorkflowTailMessage(
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

function isSubAgentCustomEventPayload(value: unknown): value is {
  eventName: 'sub-agent.event'
  data: unknown
} {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { eventName?: unknown; data?: unknown }
  return candidate.eventName === 'sub-agent.event' && 'data' in candidate
}

function toWorkflowEventWithContext(data: unknown): WorkflowEventWithContext | null {
  if (!data || typeof data !== 'object') return null
  const candidate = data as Partial<WorkflowEventWithContext>
  if (!candidate.type || !candidate.ctx || typeof candidate.ctx !== 'object') {
    return null
  }
  return candidate as WorkflowEventWithContext
}

function isToolCallSuccessPayload(value: unknown): value is {
  id: string
  result: unknown
  startedAt: number
  finishedAt: number
  durationMs: number
} {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.startedAt === 'number' &&
    typeof candidate.finishedAt === 'number' &&
    typeof candidate.durationMs === 'number'
  )
}

function isToolCallErrorPayload(value: unknown): value is { id: string; error: unknown } {
  if (!value || typeof value !== 'object') return false

  return typeof (value as { id?: unknown }).id === 'string'
}
