import { nanoid } from 'nanoid'
import type {
  Workflow,
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

  switch (event.eventName) {
    case 'workflow-start': {
      // main old: null
      // main new: a

      // main old: a
      // main new: a -> b
      const { workflowId } = event.data.ctx
      const newWorkflow = createWorkflow(workflowId, event.data.input)
      newWorkflow.runtime.status = 'running'
      if (session) {
        session.runtime.running = true
      }
      context.pushWorkflow(newWorkflow)
      context.commitBranch(workflowId)
      return
    }

    case 'workflow-finished':
      if (session) {
        session.runtime.running = false
      }
      context.updateWorkflowRuntime((runtime) => {
        runtime.status = 'finished'
        runtime.waitingHuman = false
      })
      return

    case 'workflow-aborted':
      if (session) {
        session.runtime.running = false
      }
      context.updateWorkflowRuntime((runtime) => {
        runtime.status = 'aborted'
        runtime.waitingHuman = false
      })
      return

    case 'workflow-error':
      if (session) {
        session.runtime.running = false
      }
      context.updateWorkflowRuntime((runtime) => {
        runtime.status = 'error'
        runtime.waitingHuman = false
      })
      context.pushMessage({
        id: nanoid(),
        role: 'error',
        error: event.data.error instanceof Error ? event.data.error.message : event.data.error,
      })
      return

    case 'workflow-wait-human-approve':
      context.updateWorkflowRuntime((runtime) => {
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

    case 'workflow-llm-text-start': {
      const textMessage = context.ensureLastMessage('assistant-text') as AssistantTextSessionMessage
      textMessage.streaming = true
      return
    }

    case 'workflow-llm-text-delta': {
      const textMessage = context.ensureLastMessage('assistant-text') as AssistantTextSessionMessage
      textMessage.content += event.data.chunk.delta
      return
    }
    case 'workflow-llm-text-end': {
      const textMessage = context.ensureLastMessage('assistant-text') as AssistantTextSessionMessage
      textMessage.streaming = false
      return
    }

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
      context.updateWorkflowRuntime((runtime) => {
        runtime.waitingHuman = false
      })
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
      if (event.data.toolCallResult.toolName === 'ask-user-question-generate') {
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
      context.updateWorkflowRuntime((runtime) => {
        runtime.waitingHuman = false
      })
      context.pushMessage({
        id: nanoid(),
        role: 'tool-result',
        toolCallId: event.data.toolCallResult.id,
        status: 'error',
        error: event.data.toolCallResult.error,
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

function createWorkflow(workflowId: string, input: string): Workflow {
  return {
    id: workflowId,
    input,
    feedback: null,
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
