import { MessageRole } from '@vide/ai'
import { type WorkflowData } from '@vide/main/ipcChannels'
import { useSession, useSessionStoreActions } from '../../store/sessionStore'
import {
  type Workflow,
  type WorkflowNode,
  type SessionMessage,
  type Session,
} from '../../store/sessionStore/types'
import { useEffect } from 'react'
import { context } from '../../hooks/chatContenxt'
import { useChatContext } from '../../components/chat/ChatProvider'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'

export function InitSession({ sessionId }: { sessionId: string }) {
  const { handleSend } = useChatContext()
  const { buildFromDatabase } = useSessionStoreActions()
  const { resumeRunningWorkflow } = useWorkflowStream()
  const currentSession = useSession(sessionId)
  useEffect(() => {
    const firstInput = context.firstInput

    if (firstInput) {
      context.firstInput = ''
      handleSend(firstInput)
      return
    }

    async function fetchMessages() {
      const {
        workflowData,
        planner,
        artifacts,
        activeBranch,
        branches,
        sessionType,
        origin,
        title,
        autoApprove,
      } = await window.ipcRendererApi.invoke('agent-resume-session', {
        sessionId,
      })

      const workflowNodesMap: Record<string, WorkflowNode> = {}
      let notCompletedWorkflowId: string | null = null
      for (const data of workflowData) {
        const isCompleted = await window.ipcRendererApi.invoke('query-workflow-is-completed', {
          sessionId,
          workflowId: data.id,
        })
        console.log('isCompleted', data.id, isCompleted)
        if (!isCompleted) {
          notCompletedWorkflowId = data.id
        } else {
          const workflow: Workflow = {
            id: data.id,
            input: data.userInput,
            messages: buildWorkflowMessages(data.messages, data.askUserSubmitValue ?? []),
            runtime: {
              status: data.stopStatus,
              waitingHuman: false,
            },
          }
          workflowNodesMap[data.id] = {
            workflow,
            children: [],
            parent: data.parentWorkflowId ?? null,
          }
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
        title: title,
        autoApprove: autoApprove,
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
      if (notCompletedWorkflowId) resumeRunningWorkflow(sessionId, notCompletedWorkflowId)
    }

    if (!currentSession || !currentSession.hydrated) fetchMessages()
  }, [sessionId, handleSend, buildFromDatabase, currentSession, resumeRunningWorkflow])
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
      case MessageRole.User:
        result.push({
          role: 'user',
          id: message.id,
          content: message.content || '',
        })
        break

      case MessageRole.AssistantReason:
        result.push({
          role: 'assistant-reason',
          id: message.id,
          content: message.content || '',
          reasoning: false,
        })
        break

      case MessageRole.AssistantText:
        result.push({
          role: 'assistant-text',
          id: message.id,
          content: message.content || '',
          streaming: false,
        })
        break

      case MessageRole.ToolCalls:
        for (const toolCall of JSON.parse(message.payload || '[]')) {
          toolCallsById.set(toolCall.id, toolCall)
        }
        result.push({
          role: 'tool-call',
          id: message.id,
          toolCalls: JSON.parse(message.payload || '[]'),
        })
        break

      case MessageRole.Tool: {
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
        if (toolCall?.function.name === 'ask-user-question-generate') {
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
