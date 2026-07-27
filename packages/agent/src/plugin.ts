import type { Tool, ToolCall, ToolResult } from '@vide/ai'
import type { WorkflowRuntimeEventWithCtx } from './event/channels'
import type { WorkflowRuntimeContext } from './workflow'

export type WorkflowPluginApi = {
  runtime: WorkflowRuntimeContext
}

export type WorkflowToolCallHookPayload = {
  tool: Tool
  toolCall: ToolCall
  args: Record<string, unknown>
}

export type WorkflowToolCallErrorHookPayload = {
  tool: Tool | null
  toolCall: ToolCall
  args: Record<string, unknown> | null
  error: unknown
}

export type WorkflowBeforeToolCallResult = {
  toolCall?: ToolCall
  args?: Record<string, unknown>
}

export type WorkflowToolCallResultHookPayload = WorkflowToolCallHookPayload & {
  reason: ToolResult['reason']
  result: ToolResult['result']
}

export type WorkflowToolCallResultTransform = {
  reason?: ToolResult['reason']
  result?: ToolResult['result']
  toolMessageContent?: string
}

export type WorkflowToolCallErrorTransform = {
  error?: unknown
  toolMessageContent?: string
}

export interface WorkflowPlugin {
  name: string
  transformEvent?: (
    event: WorkflowRuntimeEventWithCtx,
    api: WorkflowPluginApi
  ) => Promise<WorkflowRuntimeEventWithCtx | null | void>
  transformToolCalls?: (toolCalls: ToolCall[], api: WorkflowPluginApi) => Promise<ToolCall[] | void>
  beforeToolCall?: (
    payload: WorkflowToolCallHookPayload,
    api: WorkflowPluginApi
  ) => Promise<WorkflowBeforeToolCallResult | void>
  transformToolCallResult?: (
    payload: WorkflowToolCallResultHookPayload,
    api: WorkflowPluginApi
  ) => Promise<WorkflowToolCallResultTransform | void>
  transformToolCallError?: (
    payload: WorkflowToolCallErrorHookPayload,
    api: WorkflowPluginApi
  ) => Promise<WorkflowToolCallErrorTransform | void>
}

export function approvalWorkflowPlugin(): WorkflowPlugin {
  return {
    name: 'approval-workflow-plugin',
    async transformToolCalls(toolCalls, api) {
      return toolCalls.map((toolCall) => {
        const tool = api.runtime.getToolByName(toolCall.function.name)
        const needHumanApprove = !!tool?.approval?.required && api.runtime.autoApprove === false
        return {
          ...toolCall,
          status: needHumanApprove ? 'waiting-human' : 'auto-approved',
        }
      })
    },
  }
}

export function resolveWorkflowPlugins(plugins: WorkflowPlugin[] = []) {
  return [approvalWorkflowPlugin(), ...plugins]
}
