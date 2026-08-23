import type { Session } from '@vide/agent'
import type { WorkflowEvent } from '@vide/agent'
import type { SessionSource } from '@vide/config'
import { SessionRepository } from '@/modules/sessionRepository'
import { logger } from '@/logger'

type RecordedWorkflowEvent = WorkflowEvent & {
  ctx: { sessionId: string | null; workflowId: string | null }
}

type SessionStopStatus = 'completed' | 'error' | 'aborted'

/**
 * workflow 持久化控制器：与 AgentManager 解耦。
 *
 * 约定：
 * - workflow 运行期间不做增量落库；仅在整个 stream 真正结束后一次性落库。
 * - DB 只存「原始 agent 数据」：完整事件日志 + agent messages（OpenAI 格式）。
 *   前端 load session data 后自行派生 UI 态，本层不做任何 UI 相关判断。
 * - interrupted 仍视为运行中状态，不做持久化；应用关闭时由外层提示可能丢失未保存数据。
 */
export class WorkflowPersister {
  private pendingWorkflowIds = new Set<string>()

  markPending(workflowId: string): void {
    this.pendingWorkflowIds.add(workflowId)
  }

  clearPending(workflowId: string): void {
    this.pendingWorkflowIds.delete(workflowId)
  }

  getPendingWorkflowIds(): string[] {
    return [...this.pendingWorkflowIds]
  }

  /** stream 结束后一次性落库：workflow 行 + agent messages + 完整事件日志 + workflow 状态。 */
  async persistWorkflow(
    session: Session,
    workflowId: string,
    branchName: string,
    input: string,
    inputSource: SessionSource,
    stopStatus: SessionStopStatus,
    recordedEvents: RecordedWorkflowEvent[]
  ): Promise<void> {
    const node = session.sessionWorkflowNodes[workflowId]
    const parentId = node?.parent?.workflow.id ?? null

    try {
      await SessionRepository.createWorkflow({
        workflowId,
        sessionId: session.id,
        parentWorkflowId: parentId,
        inputSource,
        input,
      })
      await SessionRepository.upsertBranch({
        sessionId: session.id,
        name: branchName,
        headWorkflowId: workflowId,
      })
    } catch (error) {
      logger.error('WorkflowPersister createWorkflow error', error)
      return
    }

    // 1) 落 agent messages（abort/error 时保留已产出的部分消息）
    if (node) {
      try {
        await SessionRepository.saveWorkflowMessages(workflowId, node.workflow.messages)
      } catch (error) {
        logger.error('WorkflowPersister saveWorkflowMessages error', error)
      }
    }

    // 2) 落完整事件日志（一次性）
    const entries = recordedEvents.map((event, index) => {
      const { ctx: _ctx, ...payload } = event
      return {
        eventName: event.type,
        payload,
        createdAt: Date.now() + index,
      }
    })
    try {
      await SessionRepository.insertWorkflowLogs(workflowId, entries)
    } catch (error) {
      logger.error('WorkflowPersister insertWorkflowLogs error', error)
    }

    // 3) 更新 workflow 状态
    try {
      await SessionRepository.finishWorkflow(workflowId, stopStatus)
    } catch (error) {
      logger.error('WorkflowPersister finishWorkflow error', error)
    }
  }
}
