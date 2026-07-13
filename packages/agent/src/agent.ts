import { MessageRole, type AssistantChatMessage, type ChatMessage } from '@vide/ai'
import {
  Session,
  type SessionOrigin,
  type SessionBranchSnapshot,
  type SessionSnapshot,
  type SessionType,
  type WebSearchConfig,
  type SessionWorkflowSnapshot,
} from './session'

type WorkflowData = {
  id: string
  userInput: string
  parentWorkflowId: string | null
  stopStatus: 'finished' | 'error' | 'aborted'
  askUserSubmitValue?: string[]
  messages: any
}

export class Agent {
  constructor() {}

  createSession(options?: {
    sessionType?: SessionType
    origin?: SessionOrigin | null
    workspacePath?: string | null
    autoApprove?: boolean
    webSearchConfig?: WebSearchConfig
  }) {
    const session = new Session({
      sessionType: options?.sessionType,
      origin: options?.origin,
      workspacePath: options?.workspacePath,
      autoApprove: options?.autoApprove,
      webSearchConfig: options?.webSearchConfig,
    })
    session.branchs[session.activeBranch] = { head: null, source: null }

    return session
  }

  resumeSession(data: {
    sessionId: string
    sessionType: SessionType
    origin: SessionOrigin | null
    workspacePath: string | null
    activeBranch: string
    branches: SessionBranchSnapshot[]
    workflowData: WorkflowData[]
    autoApprove: boolean
  }) {
    const workflows: SessionWorkflowSnapshot[] = data.workflowData.map((workflow) => ({
      id: workflow.id,
      stopStatus: workflow.stopStatus,
      parentWorkflowId: workflow.parentWorkflowId,
      messages: this.buildChatMessages(workflow.messages),
    }))

    const snapshot: SessionSnapshot = {
      sessionId: data.sessionId,
      sessionType: data.sessionType,
      origin: data.origin,
      workspacePath: data.workspacePath,
      activeBranch: data.activeBranch,
      workflows,
      branches: data.branches,
      autoApprove: data.autoApprove,
    }

    return Session.resume(snapshot)
  }

  forkSession(session: Session, targetWorkflowId: string) {
    const targetNode = session.getWorkflowNode(targetWorkflowId)
    if (!targetNode) {
      throw new Error('Target workflow node not found: ' + targetWorkflowId)
    }
    const forkedSession = session.fork(targetNode)

    return forkedSession
  }

  buildChatMessages(messages: WorkflowData['messages']): ChatMessage[] {
    const chatMessages: ChatMessage[] = []
    let assistantMessage: AssistantChatMessage | null = null
    for (const message of messages) {
      switch (message.role) {
        case MessageRole.User: {
          chatMessages.push({
            role: 'user',
            content: message.content || '',
          })
          break
        }
        case MessageRole.Abort: {
          chatMessages.push({
            role: 'user',
            content: message.content || 'The user aborted this workflow before it completed.',
          })
          break
        }
        case MessageRole.AssistantText: {
          assistantMessage = {
            role: 'assistant',
            content: message.content || '',
          }
          chatMessages.push(assistantMessage)
          break
        }
        case MessageRole.ToolCalls: {
          if (assistantMessage) {
            assistantMessage.tool_calls = JSON.parse(message.payload || '[]')
          } else {
            chatMessages.push({
              role: 'assistant',
              content: '',
              tool_calls: JSON.parse(message.payload || '[]'),
            })
          }
          break
        }
        case MessageRole.Tool: {
          const toolResult = JSON.parse(message.payload || '{}') as
            | { id: string; toolName: string; result: any }
            | { id: string; toolName: string; error: any }
          if ('result' in toolResult) {
            chatMessages.push({
              role: 'tool',
              tool_call_id: toolResult.id,
              content: JSON.stringify(toolResult.result),
            })
          } else if ('error' in toolResult) {
            const error = toolResult.error
            chatMessages.push({
              role: 'tool',
              tool_call_id: toolResult.id,
              content: 'An exception occurred while executing toolCall: ' + String(error),
            })
          }

          break
        }
        default: {
          break
        }
      }
    }
    return chatMessages
  }
}
