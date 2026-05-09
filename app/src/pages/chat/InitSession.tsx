import { ThreadMessageRole } from '@/types'
import { useChatContext } from './ChatProvider'
import {
  useThreadStoreActions,
  type ConversationBlock,
  type ThreadMessage,
} from '../../store/threadStore'
import { useEffect } from 'react'
import { context } from '../../hooks/chatContenxt'
import type { BlockData } from '@/electron/ipc/api/channels'
import { ASK_USER_TOOL_NAMES } from '@/agent/core/tools/askUserQuestion'

export function InitSession({ threadId }: { threadId: string }) {
  const { handleSend } = useChatContext()
  const { buildFromDatabase } = useThreadStoreActions()

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
        runtime: {
          isStreaming: false,
          waitingHuman: false,
        },
        messages: buildBlockMessages(block.messages, block.askUserSubmitValue ?? []),
      }))

      const pendingPlanner = planner.find((p) => p.plan.some((i) => i.status !== 'completed'))

      buildFromDatabase({
        sessionId: threadId,
        blocks: conversationBlocks,
        currentBlockId: lastBlock.id,
        planner,
        currentPlannerId: pendingPlanner?.id,
        artifacts,
      })
    }

    fetchMessages()
  }, [threadId, handleSend, buildFromDatabase])
  return null
}

function buildBlockMessages(
  messages: BlockData['messages'],
  askUserSubmitValue: string[]
): ThreadMessage[] {
  const result: ThreadMessage[] = []
  const toolCallsById = new Map<string, { function: { name: string } }>()
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
          reasoning: message.content || '',
        })
        break

      case ThreadMessageRole.AssistantText:
        result.push({
          role: 'assistant-text',
          id: message.id,
          content: message.content || '',
          reasoning: message.content || '',
        })
        break

      case ThreadMessageRole.ToolCalls:
        for (const toolCall of JSON.parse(message.payload || '[]')) {
          toolCallsById.set(toolCall.id, toolCall)
        }
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
          status: data.error === undefined ? 'success' : 'error',
          result: data.result,
          error: data.error,
          startedAt: data.startedAt,
          finishedAt: data.finishedAt,
          durationMs: data.durationMs,
        })
        const toolCall = toolCallsById.get(data.id)
        if (toolCall?.function.name === ASK_USER_TOOL_NAMES.GENERATE) {
          const question = data.result?.question
          if (question) {
            result.push({
              role: 'ask-user',
              id: `${message.id}:ask-user`,
              completed: true,
              submitValue: askUserSubmitValue,
              title: question.title || '',
              description: question.description || '',
              type: question.type === 'multiple' ? 'multiple' : 'single',
              options: Array.isArray(question.options) ? question.options : [],
            })
          }
        }
        break
      }
    }
  }

  return result
}
