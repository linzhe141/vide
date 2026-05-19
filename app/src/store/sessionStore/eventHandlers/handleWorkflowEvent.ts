import { nanoid } from 'nanoid'
import { ASK_USER_TOOL_NAMES } from '@/agent/core/tools/askUserQuestion'
import type {
  ConversationBlock,
  PlanStep,
  Session,
  AssistantReasonSessionMessage,
  AssistantTextSessionMessage,
} from '../types'
import type { WorkflowState } from '../../../hooks/createWorkflowStream'
import { createSessionEventContext } from './utils'

export function handleWorkflowEvent(
  storeState: { sessions: Session[] },
  workflowEvent: WorkflowState
) {
  const context = createSessionEventContext(storeState, workflowEvent)
  const { event, session, planner } = context

  switch (event.type) {
    case 'workflow-start': {
      // main old: null
      // main new: a

      // main old: a
      // main new: a -> b
      const { workflowId } = event.data.ctx
      const newBlock = createConversationBlock(workflowId, event.data.input)
      newBlock.runtime.status = 'running'
      context.pushBlock(newBlock)
      context.commitBranch(workflowId)
      return
    }

    case 'workflow-finished':
      context.updateBlockRuntime((runtime) => {
        runtime.status = 'finished'
      })
      return

    case 'workflow-error':
      context.updateBlockRuntime((runtime) => {
        runtime.status = 'error'
      })
      context.pushMessage({
        id: nanoid(),
        role: 'error',
        error: event.data.error instanceof Error ? event.data.error.message : event.data.error,
      })
      return

    case 'workflow-wait-human-approve':
      context.updateBlockRuntime((runtime) => {
        runtime.waitingHuman = true
      })
      return

    case 'workflow-llm-start':
      // nothing to do
      return

    case 'workflow-llm-reasoning-start': {
      const reasoningMessage = context.ensureLastMessage(
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      reasoningMessage.reasoning = true
      return
    }
    case 'workflow-llm-reasoning-delta': {
      const reasoningMessage = context.ensureLastMessage(
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      reasoningMessage.content += event.data.chunk.delta
      return
    }
    case 'workflow-llm-reasoning-end': {
      const reasoningMessage = context.ensureLastMessage(
        'assistant-reason'
      ) as AssistantReasonSessionMessage
      reasoningMessage.reasoning = false
      return
    }

    case 'workflow-llm-text-start':
      // nothing to do
      return

    case 'workflow-llm-text-delta': {
      const textMessage = context.ensureLastMessage('assistant-text') as AssistantTextSessionMessage
      textMessage.content += event.data.chunk.delta
      return
    }
    case 'workflow-llm-text-end':
      // nothing to do
      return

    case 'workflow-llm-tool-calls-start':
      // nothing to do
      return
    case 'workflow-llm-tool-call-name':
      // nothing to do
      return
    case 'workflow-llm-tool-call-arguments':
      // nothing to do
      return
    case 'workflow-llm-tool-calls-end':
      context.pushMessage({
        id: nanoid(),
        role: 'tool-call',
        toolCalls: event.data.toolCalls,
      })
      return
    case 'workflow-llm-end':
      // nothing to do
      return

    case 'workflow-tool-call-start':
      // nothing to do
      return

    case 'workflow-tool-call-success':
      context.pushMessage({
        id: nanoid(),
        role: 'tool-result',
        toolCallId: event.data.toolCallResult.id,
        status: 'success',
        result: event.data.toolCallResult.result,
        startedAt: event.data.toolCallResult.startedAt,
        finishedAt: event.data.toolCallResult.finishedAt,
        durationMs: event.data.toolCallResult.durationMs,
      })
      if (event.data.toolCallResult.toolName === ASK_USER_TOOL_NAMES.GENERATE) {
        const question = event.data.toolCallResult.result?.question
        if (question) {
          context.pushMessage({
            id: nanoid(),
            role: 'ask-user',
            completed: true,
            submitValue: [],
            title: question.title || '',
            description: question.description || '',
            type: question.type === 'multiple' ? 'multiple' : 'single',
            options: Array.isArray(question.options) ? question.options : [],
          })
        }
      }
      return

    case 'workflow-tool-call-error':
      context.pushMessage({
        id: nanoid(),
        role: 'tool-result',
        toolCallId: event.data.toolCallResult.id,
        status: 'error',
        error: event.data.toolCallResult.error,
        startedAt: event.data.toolCallResult.startedAt,
        finishedAt: event.data.toolCallResult.finishedAt,
        durationMs: event.data.toolCallResult.durationMs,
      })
      return

    case 'planner-end-generate': {
      if (!session) return
      session.planner.push({
        id: event.data.plannerId,
        plan: event.data.plans,
      })
      return
    }

    case 'planner-execute-item-start':
      updatePlannerStepStatus(planner, event.data.plan.id, 'running')
      return

    case 'planner-execute-item-success':
      updatePlannerStepStatus(planner, event.data.plan.id, 'completed')
      return

    case 'planner-execute-item-error':
      updatePlannerStepStatus(planner, event.data.plan.id, 'failed')
      return
  }
}

function createConversationBlock(workflowId: string, input: string): ConversationBlock {
  return {
    id: workflowId,
    input,
    messages: [
      {
        id: nanoid(),
        role: 'user',
        content: input,
      },
    ],
    runtime: {
      status: 'running',
      waitingHuman: false,
    },
  }
}

function updatePlannerStepStatus(
  planner: Session['planner'][number] | undefined,
  planId: string,
  status: PlanStep['status']
) {
  const step = planner?.plan.find((item) => item.id === planId)
  if (!step) return
  step.status = status
}
