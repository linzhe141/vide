import type { Session } from '@vide/agent'
import type { WorkflowEvent } from '@vide/agent'
import { SessionRepository } from '@/modules/sessionRepository'
import { logger } from '@/logger'

type PersistableEvent = WorkflowEvent & {
  ctx: { sessionId: string | null; workflowId: string | null }
}

/** 终态事件：消息 + 日志在此一次性落库。 */
const TERMINAL_STATUS: Partial<Record<WorkflowEvent['type'], SessionStopStatus>> = {
  'workflow.completed': 'completed',
  'workflow.aborted': 'aborted',
  'workflow.error': 'error',
  'workflow.interrupted': 'interrupted',
}

type SessionStopStatus = 'completed' | 'error' | 'aborted' | 'interrupted'

/**
 * workflow 持久化控制器：与 AgentManager 解耦。
 *
 * 约定：
 * - 事件流在内存累积（不做每次 chunk 写入），仅在 workflow 到达终态
 *   （completed / aborted / error / interrupted）时一次性落库。
 * - DB 只存「原始 agent 数据」：完整事件日志 + agent messages（OpenAI 格式）。
 *   前端 load session data 后自行派生 UI 态，本层不做任何 UI 相关判断。
 * - interrupted（human-approve 中断）也视为一种终态持久化，避免重启丢失。
 */
export class WorkflowPersister {
  /** workflowId -> 累积的 { eventName, payload } 日志条目（终态一次性写入）。 */
  private logBuffer = new Map<string, { eventName: string; payload: unknown; createdAt: number }[]>()

  async consume(session: Session, event: PersistableEvent): Promise<void> {
    const workflowId = event.ctx.workflowId
    if (!workflowId) return

    const { ctx: _ctx, ...payload } = event

    if (event.type === 'workflow.start') {
      // 记录 workflow 行 + 切换活动分支 head（workflow.start 时确定 parent/input）
      const node = session.sessionWorkflowNodes[workflowId]
      const parentId = node?.parent?.workflow.id ?? null
      try {
        await SessionRepository.createWorkflow({
          workflowId,
          sessionId: session.id,
          parentWorkflowId: parentId,
          input: (event as { input: string }).input,
        })
        await SessionRepository.upsertBranch({
          sessionId: session.id,
          name: session.activeBranch,
          headWorkflowId: workflowId,
        })
      } catch (error) {
        logger.error('WorkflowPersister createWorkflow error', error)
      }
    }

    // 累积到内存缓冲，终态一次性归并写入，避免每个 chunk 都交互。
    const buffer = this.logBuffer.get(workflowId) ?? []
    buffer.push({ eventName: event.type, payload, createdAt: eventCreatedAt(event) })
    this.logBuffer.set(workflowId, buffer)

    const stopStatus = TERMINAL_STATUS[event.type]
    if (stopStatus) {
      await this.flush(session, workflowId, stopStatus)
    }
  }

  /** 终态一次性落库：agent messages + 完整事件日志 + workflow 状态。 */
  private async flush(
    session: Session,
    workflowId: string,
    stopStatus: SessionStopStatus
  ): Promise<void> {
    const node = session.sessionWorkflowNodes[workflowId]

    // 1) 落 agent messages（abort/error 时保留已产出的部分消息）
    if (node) {
      try {
        await SessionRepository.saveWorkflowMessages(workflowId, node.workflow.messages)
      } catch (error) {
        logger.error('WorkflowPersister saveWorkflowMessages error', error)
      }
    }

    // 2) 落完整事件日志（一次性）
    const entries = this.logBuffer.get(workflowId) ?? []
    try {
      await SessionRepository.insertWorkflowLogs(workflowId, entries)
    } catch (error) {
      logger.error('WorkflowPersister insertWorkflowLogs error', error)
    } finally {
      this.logBuffer.delete(workflowId)
    }

    // 3) 更新 workflow 状态
    try {
      await SessionRepository.finishWorkflow(workflowId, stopStatus)
    } catch (error) {
      logger.error('WorkflowPersister finishWorkflow error', error)
    }
  }
}

/** 事件创建时间：多数事件无 createdAt 字段，取当前时间保证日志顺序递增。 */
function eventCreatedAt(_event: WorkflowEvent): number {
  return Date.now()
}
