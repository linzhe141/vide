import { nanoid } from 'nanoid'
import type { AgentMessage, ToolCall } from '@vide/ai'
import type { SessionDataDto, SessionWorkflowData, WorkflowLogDto } from '@vide/config'
import type {
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
  _workflow: SessionWorkflowData
): SessionMessage[] {
  const messages: SessionMessage[] = []
  const deferredAskQuestionMessages: SessionMessage[] = []
  const toolCallStates = new Map<string, ToolCallState>()

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

  // ask-question 在 workflow 语义上应停在最后，提交会进入下一个 workflow。
  messages.push(...deferredAskQuestionMessages)

  return messages
}

/** 解析 tool call 的 arguments JSON。 */
function parseToolArguments(argumentsText: string): Record<string, unknown> | null {
  try {
    return JSON.parse(argumentsText) as Record<string, unknown>
  } catch {
    return null
  }
}
