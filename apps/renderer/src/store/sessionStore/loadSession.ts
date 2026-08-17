import { nanoid } from 'nanoid'
import type { AgentMessage, ToolCall } from '@vide/ai'
import type {
  // 与 apps/main/src/ipc/api/channels.ts 中 LoadedSessionPayload 保持一致
  LoadedSessionPayload,
  Session,
  WorkflowNode,
  AskQuestionOption,
  AskUserQuestionSessionMessage,
  ToolCallResult,
  Workflow,
} from './types'
export type { LoadedSessionPayload }

/**
 * 将后端 loadSession 透传的完整数据还原成前端 UI 的 Session 结构。
 * 关键点：后端 workflow.messages 是 AgentMessage（openai chat 格式），
 * 需要按顺序转换为 UI 的 SessionMessage（user / assistant-text / tool-call / ask-user-question 等）。
 */
export function reconstructSession(payload: LoadedSessionPayload): Session {
  const workflowNodesMap: Record<string, WorkflowNode> = {}

  for (const node of payload.workflowNodes) {
    const workflow: Workflow = {
      id: node.workflow.id,
      input: '',
      feedback: null,
      events: [],
      messages: buildSessionMessages(node.workflow.messages),
      runtime: {
        status: (node.workflow.stopStatus ?? 'error') as 'finished' | 'error' | 'aborted',
      },
    }
    // input 取自第一条 user message
    const firstUserMessage = workflow.messages.find((m) => m.role === 'user')
    if (firstUserMessage && firstUserMessage.role === 'user') {
      workflow.input = firstUserMessage.content
    }
    workflowNodesMap[node.workflow.id] = {
      workflow,
      children: node.children,
      parent: node.parent,
    }
  }

  return {
    sessionId: payload.sessionId,
    autoApprove: payload.autoApprove,
    thinkingMode: payload.thinkingMode,
    workspacePath: payload.workspacePath,
    title: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sessionType: 'normal',
    origin: null,
    activeBranch: payload.activeBranch,
    branches: payload.branches,
    workflowNodesMap,
    runtime: {
      running: false,
    },
    artifacts: [],
  }
}

function buildSessionMessages(messages: AgentMessage[]) {
  const result: Workflow['messages'] = []
  // 暂存 tool-call 的 toolCalls，等后续 tool message 出现时回填 result
  const toolCallsById = new Map<string, ToolCall>()

  for (const message of messages) {
    switch (message.role) {
      case 'user': {
        const content = message.content?.toString() ?? ''
        result.push({ id: nanoid(), role: 'user', content })
        break
      }
      case 'assistant': {
        const content = typeof message.content === 'string' ? message.content : ''
        if (content) {
          result.push({ id: nanoid(), role: 'assistant-text', content, streaming: false })
        }

        const toolCalls = message.tool_calls
        if (toolCalls && toolCalls.length) {
          const converted: ToolCall[] = toolCalls
            .filter((call) => 'function' in call)
            .map((call) => ({
              id: call.id,
              type: 'function' as const,
              function: {
                name: call.function?.name ?? '',
                arguments: call.function?.arguments ?? '',
              },
              status: 'auto-approved' as const,
            }))
          if (!converted.length) break
          converted.forEach((call) => toolCallsById.set(call.id, call))
          result.push({
            id: nanoid(),
            role: 'tool-call',
            toolCalls: converted.map((toolCall) => ({ toolCall })),
          })
        }
        break
      }
      case 'tool': {
        const toolCallId = message.tool_call_id
        const content = message.content?.toString() ?? ''
        const toolCall = toolCallId ? toolCallsById.get(toolCallId) : undefined
        if (!toolCall) break
        // 需要把结果回填到对应的 tool-call message 中
        const toolCallResult: ToolCallResult = {
          status: 'success',
          result: safeParse(content),
        }
        attachToolCallResult(result, toolCallId, toolCallResult)
        break
      }
      case 'system':
      case 'context':
      default:
        // UI 不展示 system/context 一类后端内部消息
        break
    }
  }

  // 还原 ask-user-question 为独立消息（与 handleWorkflowEvent 行为一致）
  extractAskUserQuestions(result)

  return result
}

function attachToolCallResult(
  messages: Workflow['messages'],
  toolCallId: string,
  result: ToolCallResult
) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'tool-call') continue
    const state = message.toolCalls.find((item) => item.toolCall.id === toolCallId)
    if (state) {
      state.result = result
      return
    }
  }
}

function extractAskUserQuestions(messages: Workflow['messages']) {
  const resolved: AskUserQuestionSessionMessage[] = []
  for (const message of messages) {
    if (message.role !== 'tool-call') continue
    for (const { toolCall } of message.toolCalls) {
      if (toolCall.function.name !== 'ask-user-question-generate') continue
      const args = safeParse(toolCall.function.arguments) as Record<string, unknown> | null
      const title = typeof args?.title === 'string' ? args.title.trim() : ''
      const description = typeof args?.description === 'string' ? args.description.trim() : ''
      const options = sanitizeAskQuestionOptions(args?.options)
      if (!title || !options.length) continue
      resolved.push({
        id: nanoid(),
        role: 'ask-user-question',
        toolCallId: toolCall.id,
        title,
        description: description || undefined,
        options,
        answer: null,
      })
    }
  }
  for (const question of resolved) {
    messages.push(question)
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

function safeParse(value: string): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
