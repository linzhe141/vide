import { SessionMessageRole } from '@/types'
import { agentEvent } from './event'
import type { AssistantChatMessage, ChatMessage } from './types'
import type { WorkflowData } from '@/electron/ipc/api/channels'
import {
  Session,
  type SessionBranchSnapshot,
  type SessionSnapshot,
  type SessionWorkflowSnapshot,
} from './session'

export class Agent {
  constructor() {}

  createSession() {
    const session = new Session()
    session.branchs[session.activeBranch] = null
    agentEvent.emit('agent-create-session', {
      sessionId: session.sessionId,
      activeBranch: session.activeBranch,
    })
    return session
  }

  resumeSession(data: {
    sessionId: string
    activeBranch: string
    branches: SessionBranchSnapshot[]
    workflowData: (WorkflowData & {
      parentWorkflowId: string | null
    })[]
  }) {
    const workflows: SessionWorkflowSnapshot[] = data.workflowData.map((workflow) => ({
      id: workflow.id,
      parentWorkflowId: workflow.parentWorkflowId,
      messages: this.buildChatMessages(workflow.messages),
    }))

    const snapshot: SessionSnapshot = {
      sessionId: data.sessionId,
      activeBranch: data.activeBranch,
      workflows,
      branches: data.branches,
    }

    return Session.resume(snapshot)
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
