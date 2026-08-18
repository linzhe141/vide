import { nanoid } from 'nanoid'
import type { AgentMessage, ToolCall } from '@vide/ai'
import type { SessionDataDto, SessionWorkflowData, WorkflowLogDto } from '@vide/config'
import type {
  AskUserQuestionSessionMessage,
  Session,
  SessionBranch,
  SessionMessage,
  ToolCallState,
  Workflow,
  WorkflowLogEvent,
  WorkflowNode,
} from './types'
import { ASK_USER_QUESTION_TOOL_NAME, sanitizeAskUserQuestions } from './askQuestion'

/**
 * 依据 SQLite 持久化的 session data（agent messages + workflow logs）派生前端 UI 态：
 * - workflow 的消息以「agent message」为权威来源，再结合 workflow logs 补全
 *   tool call 状态/结果、reasoning、error、ask-user-question 等流式信息。
 * - logs 里的 delta 事件（reason/text）用于还原流式展示内容。
 */
export function deriveSessionFromData(data: SessionDataDto): Session {
  const workflowNodesMap: Record<string, WorkflowNode> = {}
  const branches: SessionBranch[] = []

  for (const wf of data.workflows) {
    const workflow = deriveWorkflow(wf)
    const node: WorkflowNode = {
      workflow,
      parent: wf.parentWorkflowId,
      children: data.workflows
        .filter((w) => w.parentWorkflowId === wf.id)
        .map((w) => w.id),
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
  const running =
    !!headId &&
    workflowNodesMap[headId]?.workflow.runtime.status === 'running'

  return {
    sessionId: data.id,
    autoApprove: data.autoApprove,
    thinkingMode: data.thinkingMode,
    workspacePath: data.workspacePath,
    activeBranch: data.activeBranch,
    branches,
    workflowNodesMap,
    runtime: { running },
  }
}

function deriveWorkflow(wf: SessionWorkflowData): Workflow {
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
    feedback: wf.feedback,
    events: deriveLogEvents(wf.logs),
    messages: deriveMessages(decoded, wf.logs),
    runtime: { status: runtimeStatus },
  }

  // 若 messages 为空但 input 存在，补一条 user message（保证 UI 有输入展示）
  if (!workflow.messages.some((m) => m.role === 'user') && wf.input) {
    workflow.messages.unshift({
      id: nanoid(),
      role: 'user',
      content: wf.input,
    })
  }

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

function deriveLogEvents(logs: WorkflowLogDto[]): WorkflowLogEvent[] {
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

/** 依据 agent messages + workflow logs 派生 UI 的 SessionMessage[]。 */
function deriveMessages(
  agentMessages: { message: AgentMessage; createdAt: number }[],
  logs: WorkflowLogDto[]
): SessionMessage[] {
  const messages: SessionMessage[] = []
  // toolCall id -> ToolCallState，用于回填结果/状态
  const toolCallStates = new Map<string, ToolCallState>()
  const scrollInto = <T extends SessionMessage>(m: T): T => {
    messages.push(m)
    return m
  }

  for (const { message } of agentMessages) {
    switch (message.role) {
      case 'user': {
        // 提交答案会产生下一个 workflow（子节点），其 input 即该答案 JSON，由 deriveWorkflow
        // 以 user 消息形式展示。本 workflow 内不直接出现答案 user 消息。
        scrollInto({
          id: nanoid(),
          role: 'user',
          content: String(message.content ?? ''),
        })
        break
      }
      case 'assistant': {
        const content = typeof message.content === 'string' ? message.content : ''
        const toolCalls = message.tool_calls ?? []
        if (toolCalls.length) {
          const states: ToolCallState[] = []
          for (const tc of toolCalls) {
            const toolCall: ToolCall = {
              id: tc.id,
              type: 'function',
              function: {
                name: (tc as { function?: { name: string; arguments: string } }).function?.name ?? '',
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
                scrollInto({
                  id: nanoid(),
                  role: 'ask-user-question',
                  toolCallId: toolCall.id,
                  questions,
                })
              }
              continue
            }
            const state: ToolCallState = { toolCall }
            toolCallStates.set(tc.id, state)
            states.push(state)
          }
          if (states.length) {
            scrollInto({ id: nanoid(), role: 'tool-call', toolCalls: states })
          }
        }
        if (content) {
          scrollInto({ id: nanoid(), role: 'assistant-text', content, streaming: false })
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
        if (state) {
          let parsed = message.content
          if (typeof message.content === 'string') {
            try {
              parsed = JSON.parse(message.content)
            } catch {
              /* keep raw */
            }
          }
          state.result = { status: 'success', result: parsed }
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

  // 用 workflow logs 补全 tool call 状态与结果、reasoning、error、ask-user-question
  applyLogEnrichment(messages, toolCallStates, logs)

  return messages
}

function applyLogEnrichment(
  messages: SessionMessage[],
  toolCallStates: Map<string, ToolCallState>,
  logs: WorkflowLogDto[]
) {
  const reasonChunks: string[] = []
  for (const log of logs) {
    const payload = parsePayload(log.payload)
    switch (log.eventName) {
      case 'workflow.llm.reason.delta': {
        const delta = (payload as { chunk?: { delta?: string } } | null)?.chunk?.delta
        if (typeof delta === 'string') reasonChunks.push(delta)
        break
      }
      case 'workflow.llm.reason.end': {
        const content = (payload as { content?: string } | null)?.content
        if (typeof content === 'string' && !reasonChunks.length) reasonChunks.push(content)
        break
      }
      case 'workflow.llm.tool.call.end': {
        const toolCalls = (payload as { toolCall?: ToolCall[] } | null)?.toolCall
        for (const tc of toolCalls ?? []) {
          const state = toolCallStates.get(tc.id)
          if (state) state.toolCall.status = tc.status
        }
        break
      }
      case 'workflow.tool.call.start': {
        const raw = (payload as { toolCall?: { id: string; toolName: string; args: any } } | null)
          ?.toolCall
        const id = raw?.id
        const toolName = raw?.toolName
        const state = id ? toolCallStates.get(id) : undefined
        if (state) {
          if (toolName) state.toolCall.function.name = toolName
          const args = raw?.args
          if (typeof args === 'object' && args !== null) {
            state.toolCall.function.arguments = JSON.stringify(args)
          }
        }
        break
      }
      case 'workflow.tool.call.success': {
        const r = (payload as { toolCallResult?: any } | null)?.toolCallResult
        if (!r) break
        const state = toolCallStates.get(r.id)
        if (state) {
          state.result = {
            status: 'success',
            result: r.result,
            startedAt: r.startedAt,
            finishedAt: r.finishedAt,
            durationMs: r.durationMs,
          }
          state.toolCall.status = 'auto-approved'
        }
        break
      }
      case 'workflow.tool.call.error': {
        const r = (payload as { toolCallResult?: any } | null)?.toolCallResult
        if (!r) break
        const state = toolCallStates.get(r.id)
        if (state) {
          state.result = { status: 'error', error: r.error }
        }
        break
      }
      case 'workflow.llm.error': {
        const err = (payload as { error?: any } | null)?.error
        scrollIntoError(messages, err)
        break
      }
      default:
        break
    }
  }

  if (reasonChunks.length) {
    scrollIntoReason(messages, reasonChunks.join(''))
  }
}

function scrollIntoReason(messages: SessionMessage[], content: string) {
  if (!content) return
  // 若已存在末条 reasoning 则追加，否则新建
  const idx = messages.findIndex((m) => m.role === 'assistant-reason')
  if (idx < 0) {
    messages.push({ id: nanoid(), role: 'assistant-reason', content, reasoning: false })
  } else {
    messages[idx] = { id: nanoid(), role: 'assistant-reason', content, reasoning: false }
  }
}

function scrollIntoError(messages: SessionMessage[], error: unknown) {
  messages.push({ id: nanoid(), role: 'error', error })
}

function parsePayload(payload: string | null): unknown {
  if (!payload) return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
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
