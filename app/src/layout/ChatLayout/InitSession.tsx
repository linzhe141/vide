import { SessionMessageRole } from '@/types'
import { useSession, useSessionStoreActions } from '../../store/sessionStore'
import {
  type Workflow,
  type WorkflowNode,
  type SessionMessage,
  type Session,
} from '../../store/sessionStore/types'
import { useEffect } from 'react'
import { context } from '../../hooks/chatContenxt'
import type { WorkflowData } from '@/electron/ipc/api/channels'
import { ASK_USER_TOOL_NAMES } from '@/agent/core/tools/askUserQuestion'
import { useChatContext } from '../../components/chat/ChatProvider'

export function InitSession({ sessionId }: { sessionId: string }) {
  const { handleSend } = useChatContext()
  const { buildFromDatabase } = useSessionStoreActions()
  const currentSession = useSession(sessionId)
  useEffect(() => {
    const firstInput = context.firstInput

    if (firstInput) {
      context.firstInput = ''
      handleSend(firstInput)
      return
    }

    async function fetchMessages() {
      const { workflowData, planner, artifacts, activeBranch, branches, sessionType, origin } =
        await window.ipcRendererApi.invoke('agent-resume-session', {
          sessionId,
        })

      const workflowNodesMap: Record<string, WorkflowNode> = {}
      for (const data of workflowData) {
        const workflow: Workflow = {
          id: data.id,
          input: data.userInput,
          messages: buildWorkflowMessages(data.messages, data.askUserSubmitValue ?? []),
          runtime: {
            status: data.stopStatus === 'finished' ? 'finished' : 'running',
            waitingHuman: false,
          },
        }
        workflowNodesMap[data.id] = {
          workflow,
          children: [],
          parent: data.parentWorkflowId ?? null,
        }
      }
      for (const node of Object.values(workflowNodesMap)) {
        if (!node.parent) continue
        const parentNode = workflowNodesMap[node.parent]
        if (!parentNode) continue
        parentNode.children.push(node.workflow.id)
      }

      const session: Session = {
        sessionId,
        title: currentSession?.title,
        autoApprove: currentSession?.autoApprove ?? false,
        createdAt: currentSession?.createdAt,
        updatedAt: currentSession?.updatedAt,
        hydrated: true,
        sessionType,
        origin,
        activeBranch,
        branches: branches.map((branch) => ({
          name: branch.name,
          headWorkflowId: branch.headWorkflowId,
          sourceWorkflowId: branch.sourceWorkflowId,
        })),
        workflowNodesMap,
        runtime: {
          running: false,
        },
        planner,
        artifacts,
      }

      buildFromDatabase(session)
    }

    if (!currentSession || !currentSession.hydrated) fetchMessages()
  }, [sessionId, handleSend, buildFromDatabase, currentSession])
  return null
}

function buildWorkflowMessages(
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
          streaming: false,
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
