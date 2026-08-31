import type { SessionDataDto, SessionWorkflowData, WorkflowLogDto } from '@vide/config'
import type { Session, SessionBranch, Workflow, WorkflowLogEvent, WorkflowNode } from './types'
import { createWorkflowUiModel, rebuildWorkflowMessages } from './workflowMessageModel'

/** 依据持久化 workflow logs 重建 renderer 里的 workflow/message/log 视图。 */
export function buildSessionFromData(data: SessionDataDto): Session {
  const workflowNodesMap: Record<string, WorkflowNode> = {}
  const branches: SessionBranch[] = []

  for (const wf of data.workflows) {
    const workflow = buildWorkflow(wf, data.thinkingMode)
    const node: WorkflowNode = {
      workflow,
      parent: wf.parentWorkflowId,
      children: data.workflows
        .filter((item) => item.parentWorkflowId === wf.id)
        .map((item) => item.id),
    }
    workflowNodesMap[wf.id] = node
  }

  for (const branch of data.branches) {
    branches.push({
      name: branch.name,
      headWorkflowId: branch.headWorkflowId,
      sourceWorkflowId: branch.sourceWorkflowId,
    })
  }

  const activeBranch = branches.find((branch) => branch.name === data.activeBranch)
  const headId = activeBranch?.headWorkflowId ?? null
  const running = !!headId && workflowNodesMap[headId]?.workflow.runtime.status === 'running'

  return {
    sessionId: data.id,
    sessionSource: data.sessionSource,
    autoApprove: data.autoApprove,
    thinkingMode: data.thinkingMode,
    workspacePath: data.workspacePath,
    activeBranch: data.activeBranch,
    branches,
    workflowNodesMap,
    runtime: { running, renderVersion: 0 },
  }
}

function buildWorkflow(wf: SessionWorkflowData, thinkingMode: boolean): Workflow {
  const workflow = createWorkflowUiModel(wf.id, wf.input, wf.inputSource)
  workflow.feedback = wf.feedback
  workflow.events = buildLogEvents(wf.logs)
  workflow.runtime.status = mapStopStatusToRuntimeStatus(wf.stopStatus)
  rebuildWorkflowMessages(workflow, thinkingMode)
  workflow.runtime.status = mapStopStatusToRuntimeStatus(wf.stopStatus)
  return workflow
}

function buildLogEvents(logs: WorkflowLogDto[]): WorkflowLogEvent[] {
  return logs.map((log) => {
    let payload: unknown = undefined
    if (log.payload) {
      try {
        payload = JSON.parse(log.payload)
      } catch {
        payload = log.payload
      }
    }

    return {
      id: log.id,
      type: log.eventName,
      createdAt: log.createdAt,
      payload,
    }
  })
}

function mapStopStatusToRuntimeStatus(
  stopStatus: SessionWorkflowData['stopStatus']
): Workflow['runtime']['status'] {
  switch (stopStatus) {
    case 'completed':
      return 'finished'
    case 'aborted':
      return 'aborted'
    case 'error':
      return 'error'
    case 'interrupted':
      return 'interrupted'
    default:
      return 'running'
  }
}
