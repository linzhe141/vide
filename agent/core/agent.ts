import { SessionMessageRole } from '@/types'
import { agentEvent } from './event'
import type { AssistantChatMessage, ChatMessage } from './types'
import type { WorkflowData } from '@/electron/ipc/api/channels'
import {
  Session,
  type SessionOrigin,
  type SessionBranchSnapshot,
  type SessionSnapshot,
  type SessionType,
  type SessionWorkflowSnapshot,
} from './session'

export class Agent {
  constructor() {}

  createSession(options?: {
    sessionType?: SessionType
    origin?: SessionOrigin | null
    workspacePath?: string | null
  }) {
    const session = new Session({
      sessionType: options?.sessionType,
      origin: options?.origin,
      workspacePath: options?.workspacePath,
    })
    session.branchs[session.activeBranch] = { head: null, source: null }
    agentEvent.emit('agent-create-session', {
      sessionId: session.sessionId,
      activeBranch: session.activeBranch,
      sessionType: session.sessionType,
      originSessionId: session.origin?.sessionId || null,
      originWorkflowId: session.origin?.workflowId || null,
      workspacePath: session.workspacePath,
    })
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
  }) {
    const workflows: SessionWorkflowSnapshot[] = data.workflowData.map((workflow) => ({
      id: workflow.id,
      status: workflow.status,
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
    }

    return Session.resume(snapshot)
  }

  forkSession(session: Session, targetWorkflowId: string) {
    const targetNode = session.getWorkflowNode(targetWorkflowId)
    if (!targetNode) {
      throw new Error('Target workflow node not found: ' + targetWorkflowId)
    }
    const forkedSession = session.fork(targetNode)
    agentEvent.emit('agent-create-session', {
      sessionId: forkedSession.sessionId,
      activeBranch: forkedSession.activeBranch,
      sessionType: forkedSession.sessionType,
      originSessionId: forkedSession.origin?.sessionId || null,
      originWorkflowId: forkedSession.origin?.workflowId || null,
      workspacePath: forkedSession.workspacePath,
    })
    agentEvent.emit('agent-session-forked', {
      sourceSessionId: session.sessionId,
      forkedSessionId: forkedSession.sessionId,
      sourceWorkflowId: targetWorkflowId,
    })
    return forkedSession
  }

  buildChatMessages(messages: WorkflowData['messages']) {
    const chatMessages: ChatMessage[] = []
    let assistantMessage: AssistantChatMessage | null = null
    for (const message of messages) {
      switch (message.role) {
        case SessionMessageRole.User: {
          chatMessages.push({
            role: 'user',
            content: message.content || '',
          })
          break
        }
        case SessionMessageRole.AssistantText: {
          assistantMessage = {
            role: 'assistant',
            content: message.content || '',
          }
          chatMessages.push(assistantMessage)
          break
        }
        case SessionMessageRole.ToolCalls: {
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
        case SessionMessageRole.Tool: {
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
