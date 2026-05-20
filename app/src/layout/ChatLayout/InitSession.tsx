import { SessionMessageRole } from '@/types'
import { useSessionStoreActions } from '../../store/sessionStore'
import { type Workflow, type SessionMessage } from '../../store/sessionStore/types'
import { useEffect } from 'react'
import { context } from '../../hooks/chatContenxt'
import type { WorkflowData } from '@/electron/ipc/api/channels'
import { ASK_USER_TOOL_NAMES } from '@/agent/core/tools/askUserQuestion'
import { useChatContext } from '../../components/chat/ChatProvider'

export function InitSession({ sessionId }: { sessionId: string }) {
  const { handleSend } = useChatContext()
  const { buildFromDatabase } = useSessionStoreActions()

  useEffect(() => {
    const firstInput = context.firstInput

    if (firstInput) {
      context.firstInput = ''
      handleSend(firstInput)
      return
    }

    async function fetchMessages() {
      // const { blockData, planner, artifacts, activeBranch, branches } =
      //   await window.ipcRendererApi.invoke('agent-resume-session', {
      //     sessionId: sessionId,
      //   })
      // const conversationBlockMap: Record<string, ConversationBlock> = Object.fromEntries(
      //   blockData.map((block) => [
      //     block.id,
      //     {
      //       id: block.id,
      //       parentBlockId: block.parentBlockId ?? null,
      //       childBlockIds: [],
      //       input: block.userInput,
      //       status: 'finished',
      //       runtime: {
      //         status: 'finished',
      //         waitingHuman: false,
      //       },
      //       messages: buildBlockMessages(block.messages, block.askUserSubmitValue ?? []),
      //     } satisfies ConversationBlock,
      //   ])
      // )
      // for (const block of Object.values(conversationBlockMap)) {
      //   if (!block.parentBlockId) continue
      //   const parentBlock = conversationBlockMap[block.parentBlockId]
      //   if (!parentBlock) continue
      //   parentBlock.childBlockIds.push(block.id)
      // }
      // const pendingPlanner = planner.find((p) => p.plan.some((i) => i.status !== 'completed'))
      // const activeHead = branches.find((branch) => branch.name === activeBranch)?.headWorkflowId
      // buildFromDatabase({
      //   sessionId: sessionId,
      //   activeBranch,
      //   branches: branches.map((branch) => ({
      //     name: branch.name,
      //     headBlockId: branch.headWorkflowId,
      //   })),
      //   blockMap: conversationBlockMap,
      //   blockOrder: blockData.map((block) => block.id),
      //   currentBlockId: activeHead || undefined,
      //   planner,
      //   currentPlannerId: pendingPlanner?.id,
      //   runtime: {
      //     running: false,
      //   },
      //   artifacts,
      // })
    }

    fetchMessages()
  }, [sessionId, handleSend, buildFromDatabase])
  return null
}

function buildBlockMessages(
  messages: WorkflowData['messages'],
  askUserSubmitValue: string[]
): SessionMessage[] {
  const result: SessionMessage[] = []
  const toolCallsById = new Map<string, { function: { name: string } }>()
  for (const message of messages) {
    switch (message.role) {
      case SessionMessageRole.User:
        result.push({
          role: 'user',
          id: message.id,
          content: message.content || '',
        })
        break

      case SessionMessageRole.AssistantReason:
        result.push({
          role: 'assistant-reason',
          id: message.id,
          content: message.content || '',
          reasoning: false,
        })
        break

      case SessionMessageRole.AssistantText:
        result.push({
          role: 'assistant-text',
          id: message.id,
          content: message.content || '',
        })
        break

      case SessionMessageRole.ToolCalls:
        for (const toolCall of JSON.parse(message.payload || '[]')) {
          toolCallsById.set(toolCall.id, toolCall)
        }
        result.push({
          role: 'tool-call',
          id: message.id,
          toolCalls: JSON.parse(message.payload || '[]'),
        })
        break

      case SessionMessageRole.Tool: {
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
