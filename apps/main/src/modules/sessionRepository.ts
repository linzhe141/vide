import { and, asc, eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import type { AgentMessage } from '@vide/ai'
import type { SessionDataDto } from '@vide/config'
import { db } from '@/db/databaseManager'
import {
  sessionBranches,
  sessionWorkflows,
  sessions,
  workflowLogs,
  workflowMessages,
} from '@/db/schema'

/**
 * 会话持久化仓库。
 *
 * 负责将 session / workflow / branch / agent message / workflow log 落库，
 * 以及 load 单个 session 的完整持久化数据（SessionDataDto）。
 * - workflow 的消息以「agent message」形式整段保存，前端 load 后再派生 UI 消息。
 * - 表之间不做数据库层自引用外键，关系（parentWorkflowId / headWorkflowId 等）由代码维护。
 */
export class SessionRepository {
  static async ensureSession(data: {
    id: string
    title?: string | null
    type: 'normal' | 'fork'
    originSessionId?: string | null
    originWorkflowId?: string | null
    workspacePath?: string | null
    autoApprove?: boolean
    thinkingMode?: boolean
    activeBranch?: string
  }): Promise<void> {
    const time = Date.now()
    const rows = await db.select().from(sessions).where(eq(sessions.id, data.id))
    const existing = rows[0]
    if (existing) {
      await db
        .update(sessions)
        .set({
          title: data.title ?? existing.title,
          type: data.type ?? existing.type,
          originSessionId: data.originSessionId ?? existing.originSessionId,
          originWorkflowId: data.originWorkflowId ?? existing.originWorkflowId,
          workspacePath: data.workspacePath ?? existing.workspacePath,
          autoApprove: data.autoApprove ?? existing.autoApprove,
          thinkingMode: data.thinkingMode ?? existing.thinkingMode,
          activeBranch: data.activeBranch ?? existing.activeBranch,
          updatedAt: time,
        })
        .where(eq(sessions.id, data.id))
      return
    }
    await db.insert(sessions).values({
      id: data.id,
      title: data.title ?? '',
      type: data.type,
      originSessionId: data.originSessionId ?? null,
      originWorkflowId: data.originWorkflowId ?? null,
      workspacePath: data.workspacePath ?? null,
      autoApprove: data.autoApprove ?? false,
      thinkingMode: data.thinkingMode ?? false,
      activeBranch: data.activeBranch ?? 'main',
      createdAt: time,
      updatedAt: time,
    })
  }

  static async setSessionTitle(sessionId: string, title: string): Promise<void> {
    const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId))
    if (!rows.length || rows[0].title) return
    await db
      .update(sessions)
      .set({ title, updatedAt: Date.now() })
      .where(eq(sessions.id, sessionId))
  }

  static async setSessionAutoApprove(sessionId: string, autoApprove: boolean): Promise<void> {
    await db
      .update(sessions)
      .set({ autoApprove, updatedAt: Date.now() })
      .where(eq(sessions.id, sessionId))
  }

  static async setSessionThinkingMode(sessionId: string, thinkingMode: boolean): Promise<void> {
    await db
      .update(sessions)
      .set({ thinkingMode, updatedAt: Date.now() })
      .where(eq(sessions.id, sessionId))
  }

  /** upsert 一个分支：headWorkflowId 需要时更新，name 唯一（session + name）。 */
  static async upsertBranch(data: {
    sessionId: string
    name: string
    headWorkflowId: string | null
    sourceWorkflowId?: string | null
  }): Promise<void> {
    const time = Date.now()
    const rows = await db
      .select()
      .from(sessionBranches)
      .where(
        and(eq(sessionBranches.sessionId, data.sessionId), eq(sessionBranches.name, data.name))
      )
    const existing = rows[0]
    if (existing) {
      await db
        .update(sessionBranches)
        .set({
          headWorkflowId: data.headWorkflowId,
          sourceWorkflowId:
            data.sourceWorkflowId === undefined ? existing.sourceWorkflowId : data.sourceWorkflowId,
          updatedAt: time,
        })
        .where(eq(sessionBranches.id, existing.id))
      return
    }
    await db.insert(sessionBranches).values({
      id: uuid(),
      sessionId: data.sessionId,
      name: data.name,
      headWorkflowId: data.headWorkflowId,
      sourceWorkflowId: data.sourceWorkflowId ?? null,
      createdAt: time,
      updatedAt: time,
    })
  }

  /** 切换当前活动分支，并确保该分支存在。 */
  static async switchBranch(sessionId: string, branchName: string): Promise<void> {
    await this.upsertBranch({ sessionId, name: branchName, headWorkflowId: null })
    await db
      .update(sessions)
      .set({ activeBranch: branchName, updatedAt: Date.now() })
      .where(eq(sessions.id, sessionId))
  }

  static async createWorkflow(data: {
    workflowId: string
    sessionId: string
    parentWorkflowId: string | null
    input: string
  }): Promise<void> {
    const time = Date.now()
    await db.insert(sessionWorkflows).values({
      id: data.workflowId,
      sessionId: data.sessionId,
      parentWorkflowId: data.parentWorkflowId,
      input: data.input,
      createdAt: time,
      updatedAt: time,
    })
  }

  static async finishWorkflow(workflowId: string, stopStatus: 'finished' | 'error' | 'aborted') {
    await db
      .update(sessionWorkflows)
      .set({ stopStatus, updatedAt: Date.now() })
      .where(eq(sessionWorkflows.id, workflowId))
  }

  static async updateWorkflowFeedback(
    workflowId: string,
    feedback: 'like' | 'dislike' | null
  ): Promise<void> {
    await db
      .update(sessionWorkflows)
      .set({ feedback, updatedAt: Date.now() })
      .where(eq(sessionWorkflows.id, workflowId))
  }

  /**
   * 整段保存一个 workflow 的 agent messages（先删后插，保证与内存态一致）。
   * messages 为 OpenAI 格式的 AgentMessage[]。
   */
  static async saveWorkflowMessages(
    workflowId: string,
    messages: AgentMessage[]
  ): Promise<void> {
    await db.delete(workflowMessages).where(eq(workflowMessages.workflowId, workflowId))

    if (!messages.length) return
    const time = Date.now()
    const serialized = messages.map((message, index) => {
      const snapshot = messageSnapshot(message)
      return {
        id: uuid(),
        workflowId,
        role: message.role,
        content: snapshot.content,
        payload: JSON.stringify(message),
        createdAt: time + index,
        updatedAt: time + index,
      }
    })
    await db.insert(workflowMessages).values(serialized)
  }

  /** 追加一条 workflow stream 日志事件。eventName 对应 WorkflowEvent['type']。 */
  static async appendWorkflowLog(
    workflowId: string,
    eventName: string,
    payload: unknown,
    createdAt = Date.now()
  ): Promise<void> {
    await db.insert(workflowLogs).values({
      id: uuid(),
      workflowId,
      eventName,
      payload: payload === undefined ? null : JSON.stringify(payload),
      createdAt,
    })
  }

  /** 列表用：返回所有 session 的轻量元数据。 */
  static async listSessions(): Promise<
    {
      id: string
      title: string | null
      type: 'normal' | 'fork'
      originSessionId: string | null
      originWorkflowId: string | null
      workspacePath: string | null
      autoApprove: boolean
      thinkingMode: boolean
      createdAt: number
      updatedAt: number
    }[]
  > {
    const rows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        type: sessions.type,
        originSessionId: sessions.originSessionId,
        originWorkflowId: sessions.originWorkflowId,
        workspacePath: sessions.workspacePath,
        autoApprove: sessions.autoApprove,
        thinkingMode: sessions.thinkingMode,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      })
      .from(sessions)
      .orderBy(asc(sessions.updatedAt))
    return rows
  }

  /** load 单个 session 的完整持久化数据。 */
  static async loadSessionData(sessionId: string): Promise<SessionDataDto | null> {
    const sessionRows = await db.select().from(sessions).where(eq(sessions.id, sessionId))
    const session = sessionRows[0]
    if (!session) return null

    const branchRows = await db
      .select()
      .from(sessionBranches)
      .where(eq(sessionBranches.sessionId, sessionId))
      .orderBy(asc(sessionBranches.createdAt))

    const workflowRows = await db
      .select()
      .from(sessionWorkflows)
      .where(eq(sessionWorkflows.sessionId, sessionId))
      .orderBy(asc(sessionWorkflows.createdAt))

    const workflows = await Promise.all(
      workflowRows.map(async (workflow) => {
        const [messageRows, logRows] = await Promise.all([
          db
            .select()
            .from(workflowMessages)
            .where(eq(workflowMessages.workflowId, workflow.id))
            .orderBy(asc(workflowMessages.createdAt)),
          db
            .select()
            .from(workflowLogs)
            .where(eq(workflowLogs.workflowId, workflow.id))
            .orderBy(asc(workflowLogs.createdAt)),
        ])
        return {
          id: workflow.id,
          parentWorkflowId: workflow.parentWorkflowId,
          stopStatus: workflow.stopStatus,
          feedback: workflow.feedback,
          input: workflow.input,
          agentMessages: messageRows.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            payload: m.payload,
            createdAt: m.createdAt,
          })),
          logs: logRows.map((l) => ({
            id: l.id,
            eventName: l.eventName,
            payload: l.payload,
            createdAt: l.createdAt,
          })),
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
        }
      })
    )

    return {
      id: session.id,
      title: session.title ?? '',
      type: session.type,
      origin:
        session.originSessionId != null
          ? { sessionId: session.originSessionId, workflowId: session.originWorkflowId }
          : null,
      activeBranch: session.activeBranch,
      autoApprove: session.autoApprove,
      thinkingMode: session.thinkingMode,
      workspacePath: session.workspacePath,
      branches: branchRows.map((b) => ({
        name: b.name,
        headWorkflowId: b.headWorkflowId,
        sourceWorkflowId: b.sourceWorkflowId,
      })),
      workflows,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }
  }
}

/** 提取 AgentMessage 的可读文本快照，便于数据库查看（内容可能为数组/对象）。 */
function messageSnapshot(message: AgentMessage): { content: string | null } {
  const content = messageContentToText(message.content as never)
  return { content }
}

function messageContentToText(content: unknown): string | null {
  if (content == null) return null
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return JSON.stringify(content)
  }
  return JSON.stringify(content)
}
