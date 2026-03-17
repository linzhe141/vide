import { ThreadMessageRole } from '@/types'
import { AgentSession } from './agentSession'
import { agentEvent } from './event'
import type { AssistantChatMessage, ChatMessage } from './types'
import type { BlockData } from '@/electron/ipc/api/channels'

export class Agent {
  constructor() {}

  createSession() {
    const agetnSession = new AgentSession()
    agentEvent.emit('agent-create-session', { sessionId: agetnSession.sessionId })
    return agetnSession
  }

  resumeSession({ sessionId, blockData }: { sessionId: string; blockData: BlockData[] }) {
    const resumeAgetnSession = new AgentSession()
    resumeAgetnSession.sessionId = sessionId
    resumeAgetnSession.workflowBlocks = []
    for (const block of blockData) {
      const worlflowBlock = resumeAgetnSession.buildWorlflowBlock(block.userInput)
      worlflowBlock.runtime.thread.ctx.messages = this.buildChatMessages(block.messages)

      resumeAgetnSession.workflowBlocks.push(worlflowBlock)
    }
    return resumeAgetnSession
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
