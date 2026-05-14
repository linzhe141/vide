import { ThreadMessageRole } from '@/types'
import { agentEvent } from './event'
import type { AssistantChatMessage, ChatMessage } from './types'
import type { BlockData } from '@/electron/ipc/api/channels'
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
    blockData: (BlockData & {
      parentBlockId: string | null
      branchName: string
    })[]
  }) {
    const workflows: SessionWorkflowSnapshot[] = data.blockData.map((block) => ({
      id: block.id,
      parentWorkflowId: block.parentBlockId,
      branchName: block.branchName,
      messages: this.buildChatMessages(block.messages),
    }))

    const snapshot: SessionSnapshot = {
      sessionId: data.sessionId,
      activeBranch: data.activeBranch,
      workflows,
      branches: data.branches,
    }

    return Session.resume(snapshot)
  }

  buildChatMessages(messages: BlockData['messages']) {
    const chatMessages: ChatMessage[] = []
    let assistantMessage: AssistantChatMessage | null = null
    for (const message of messages) {
      switch (message.role) {
        case ThreadMessageRole.User: {
          chatMessages.push({
            role: 'user',
            content: message.content || '',
          })
          break
        }
        case ThreadMessageRole.AssistantText: {
          assistantMessage = {
            role: 'assistant',
            content: message.content || '',
          }
          chatMessages.push(assistantMessage)
          break
        }
        case ThreadMessageRole.ToolCalls: {
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
        case ThreadMessageRole.Tool: {
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
