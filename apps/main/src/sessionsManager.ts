import { onWorkflowEvent } from '@vide/agent'

import type { AppManager } from './appManager'
import { SessionStorage } from './services/sessionStorage'

export class SessionsManager {
  constructor(private app: AppManager) {}

  init() {
    this.setupAgentEvents()
  }

  setupAgentEvents() {
    onWorkflowEvent('workflow-start', async ({ input, ctx }) => {
      await SessionStorage.setSessionTitle(ctx.sessionId, input)
      await SessionStorage.createWorkflow({
        workflowId: ctx.workflowId,
        sessionId: ctx.sessionId,
        parentWorkflowId: ctx.parentWorkflowId,
        input,
      })
      await SessionStorage.upsertSessionBranch({
        sessionId: ctx.sessionId,
        branchName: ctx.branchName,
        headWorkflowId: ctx.workflowId,
      })
      await SessionStorage.insertUserMessage(ctx.workflowId, input)
    })

    onWorkflowEvent('workflow-finished', async ({ ctx }) => {
      await SessionStorage.finishWorkflow(ctx.workflowId)
    })
    // TODO
    // workflow-wait-human-approve 鏇存柊 stopStatus 涓?waiting-human-approve 鐘舵€?
    // onWorkflowEvent('workflow-wait-human-approve', async ({ ctx }) => {
    //   await db
    //     .update(sessionWorkflows)
    //     .set({
    //       stopStatus: 'waiting-human-approve',
    //       updatedAt: Date.now(),
    //     })
    //     .where(eq(sessionWorkflows.id, ctx.workflowId))
    // })
    onWorkflowEvent('workflow-aborted', async ({ ctx, chunkData }) => {
      await SessionStorage.abortWorkflow(ctx.workflowId, chunkData)
    })
    onWorkflowEvent('workflow-error', async ({ ctx, error }) => {
      console.log(error)
      await SessionStorage.errorWorkflow(ctx.workflowId)
    })

    onWorkflowEvent('workflow-llm-start', async () => {})
    onWorkflowEvent('workflow-llm-error', async () => {})

    onWorkflowEvent('workflow-llm-reasoning-start', async () => {})
    onWorkflowEvent('workflow-llm-reasoning-delta', async () => {})
    onWorkflowEvent('workflow-llm-reasoning-end', async ({ ctx: { workflowId }, content }) => {
      await SessionStorage.insertAssistantReasoning(workflowId, content)
    })

    onWorkflowEvent('workflow-llm-text-start', async () => {})
    onWorkflowEvent('workflow-llm-text-delta', async () => {})
    onWorkflowEvent('workflow-llm-text-end', async ({ ctx: { workflowId }, content }) => {
      await SessionStorage.insertAssistantText(workflowId, content)
    })

    onWorkflowEvent('workflow-llm-tool-calls-start', async () => {})
    onWorkflowEvent('workflow-llm-tool-call-name', async () => {})
    onWorkflowEvent('workflow-llm-tool-call-arguments', async () => {})
    onWorkflowEvent('workflow-llm-tool-calls-end', async ({ ctx: { workflowId }, toolCalls }) => {
      await SessionStorage.insertToolCalls(workflowId, toolCalls)
    })

    onWorkflowEvent('workflow-tool-call-start', async () => {})
    onWorkflowEvent('workflow-tool-call-success', async ({ ctx, toolCallResult }) => {
      await SessionStorage.insertToolResult(ctx.workflowId, toolCallResult)
    })
    onWorkflowEvent('workflow-tool-call-error', async ({ ctx, toolCallResult }) => {
      await SessionStorage.insertToolResult(ctx.workflowId, toolCallResult)
    })
    onWorkflowEvent('workflow-tool-call-reject', async ({ ctx, toolCallResult }) => {
      await SessionStorage.insertToolResult(ctx.workflowId, toolCallResult)
    })

    onWorkflowEvent('planner-end-generate', async ({ ctx: { sessionId }, plannerId, plans }) => {
      await SessionStorage.createPlanner(sessionId, plannerId, plans)
    })
    onWorkflowEvent('planner-execute-item-start', async ({ plan, plannerId }) => {
      await SessionStorage.updatePlanner(plannerId, plan)
    })
    onWorkflowEvent('planner-execute-item-success', async ({ plan, plannerId }) => {
      await SessionStorage.updatePlanner(plannerId, plan)
    })
    onWorkflowEvent('planner-execute-item-error', async ({ plan, plannerId }) => {
      await SessionStorage.updatePlanner(plannerId, plan)
    })

    onWorkflowEvent('ask-user', async ({ workflowId, question }) => {
      await SessionStorage.insertAskUserQuestion(workflowId, question)
    })

    onWorkflowEvent(
      'artifacts-created-workspace',
      async ({ ctx: { sessionId }, workspaceName }) => {
        await SessionStorage.createArtifactWorkspace(sessionId, workspaceName)
      }
    )
  }
}
