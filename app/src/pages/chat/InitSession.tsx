import { ThreadMessageRole } from '@/types'
import { useChatContext } from './ChatProvider'
import { useThreadStore, type ConversationBlock, type ThreadMessage } from '../../store/threadStore'
import { useEffect } from 'react'
import { context } from '../../hooks/chatContenxt'
import type { BlockData } from '@/electron/ipc/api/channels'

export function InitSession({ threadId }: { threadId: string }) {
  const { handleSend } = useChatContext()
  const { buildFromDatabase } = useThreadStore()

  useEffect(() => {
    const firstInput = context.firstInput

    if (firstInput) {
      context.firstInput = ''
      handleSend(firstInput)
      return
    }

    async function fetchMessages() {
      const { blockData, planner, artifacts } = await window.ipcRendererApi.invoke(
        'agent-resume-session',
        {
          sessionId: threadId,
        }
      )

      const lastBlock = blockData.at(-1)
      if (!lastBlock) return

      const conversationBlocks: ConversationBlock[] = blockData.map((block) => ({
        id: block.id,
        input: block.userInput,
        status: 'finished',
        askUser: block.askUser,
        runtime: {} as any,
        messages: buildBlockMessages(block.messages),
      }))

      const pendingPlanner = planner.find((p) => p.plan.some((i) => i.status !== 'completed'))

      buildFromDatabase({
        sessionId: threadId,
        blocks: conversationBlocks,
        currentBlockId: lastBlock.id,
        planner,
        currentPlannerId: pendingPlanner?.id,
        artifacts,
        streaming: false,
      })
    }

    fetchMessages()
  }, [threadId, handleSend, buildFromDatabase])
  return null
}

function buildBlockMessages(messages: BlockData['messages']): ThreadMessage[] {
  const result: ThreadMessage[] = []

  for (const message of messages) {
    switch (message.role) {
      case ThreadMessageRole.User:
        result.push({
          role: 'user',
          id: message.id,
          content: message.content || '',
        })
        break

      case ThreadMessageRole.AssistantReason:
        result.push({
          role: 'assistant-reason',
          id: message.id,
          content: message.content || '',
        })
        break

      case ThreadMessageRole.AssistantText:
        result.push({
          role: 'assistant-text',
          id: message.id,
          content: message.content || '',
        })
        break

      case ThreadMessageRole.ToolCalls:
        result.push({
          role: 'tool-call',
          id: message.id,
          toolCalls: JSON.parse(message.payload || '[]'),
        })
        break

      case ThreadMessageRole.Tool: {
        const data = JSON.parse(message.payload || '{}')
        result.push({
          role: 'tool-result',
          id: message.id,
          toolCallId: data.id,
          result: data.result ?? data.error,
        })
        break
      }
    }
  }

  return result
}
