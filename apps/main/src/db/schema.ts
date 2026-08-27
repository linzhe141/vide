import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * 会话 / 工作流 / 分支 / agent 消息 / 工作流日志 的持久化表结构。
 *
 * 约定：
 * - 不做数据库层的自引用外键（parentWorkflowId / originSessionId / headWorkflowId /
 *   sourceWorkflowId 等均为普通 text 列，无 FK 约束），关系由代码维护。
 * - worklfow 的消息以「agent message」的形式落库（OpenAI 格式的 AgentMessage），
 *   前端在 load session data 后自行派生到 UI 侧的 message。
 * - workflow_logs 保存每个 workflow stream 的完整事件日志，前端按需展示。
 */

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  type: text('type', { enum: ['normal', 'fork'] })
    .notNull()
    .default('normal'),
  sessionSource: text('session_source', { enum: ['desktop', 'wechat-bot'] })
    .notNull()
    .default('desktop'),
  // 普通 text 列，不用 FK（避免自引用）。由代码维护 fork 关系。
  originSessionId: text('origin_session_id'),
  originWorkflowId: text('origin_workflow_id'),
  workspacePath: text('workspace_path'),
  activeBranch: text('active_branch').notNull().default('main'),
  autoApprove: integer('auto_approve', { mode: 'boolean' }).notNull().default(false),
  thinkingMode: integer('thinking_mode', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessionWorkflows = sqliteTable('session_workflows', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id),
  // 普通 text 列，不用 FK（避免自引用）。由代码维护父子关系。
  parentWorkflowId: text('parent_workflow_id'),
  inputSource: text('input_source', { enum: ['desktop', 'wechat-bot'] })
    .notNull()
    .default('desktop'),
  stopStatus: text('stop_status', {
    enum: ['completed', 'error', 'aborted', 'interrupted'],
  }),
  feedback: text('feedback', { enum: ['like', 'dislike'] }),
  input: text('input').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessionBranches = sqliteTable(
  'session_branches',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    name: text('name').notNull(),
    // 普通 text 列，不用 FK（避免自引用）。由代码维护分支图。
    headWorkflowId: text('head_workflow_id'),
    sourceWorkflowId: text('source_workflow_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    sessionNameUnique: uniqueIndex('session_branches_session_name_unique').on(
      table.sessionId,
      table.name
    ),
  })
)

/**
 * workflow 下的 agent message（OpenAI 格式）。
 * role 为 agent 侧角色：system / user / assistant / tool / context。
 * content 为 content 字段的文本快照（便于查看），payload 为完整 AgentMessage 的 JSON 序列化，
 * 前端 load 时直接 JSON.parse(payload) 还原成 AgentMessage 再派生 UI 消息。
 */
export const workflowMessages = sqliteTable('workflow_messages', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => sessionWorkflows.id),
  role: text('role').notNull(),
  content: text('content'),
  payload: text('payload'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * workflow 的完整 stream 日志（每个事件一条）。
 * eventName 对应 WorkflowEvent['type']；payload 为不含 ctx 的事件载荷的 JSON 序列化。
 * 前端 load 后根据日志选择性地展示。
 */
export const workflowLogs = sqliteTable('workflow_logs', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => sessionWorkflows.id),
  eventName: text('event_name').notNull(),
  payload: text('payload'),
  createdAt: integer('created_at').notNull(),
})

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    githubId: text('github_id').notNull(),
    username: text('username').notNull(),
    avatarUrl: text('avatar_url'),
    email: text('email'),
    accessToken: text('access_token').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    githubIdUnique: uniqueIndex('users_github_id_unique').on(table.githubId),
  })
)

export const sessionsRelations = relations(sessions, ({ many }) => ({
  workflows: many(sessionWorkflows),
  branches: many(sessionBranches),
}))

export const sessionWorkflowsRelations = relations(sessionWorkflows, ({ many }) => ({
  messages: many(workflowMessages),
  logs: many(workflowLogs),
}))

export const sessionBranchesRelations = relations(sessionBranches, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionBranches.sessionId],
    references: [sessions.id],
  }),
}))

export const workflowMessagesRelations = relations(workflowMessages, ({ one }) => ({
  workflow: one(sessionWorkflows, {
    fields: [workflowMessages.workflowId],
    references: [sessionWorkflows.id],
  }),
}))

export const workflowLogsRelations = relations(workflowLogs, ({ one }) => ({
  workflow: one(sessionWorkflows, {
    fields: [workflowLogs.workflowId],
    references: [sessionWorkflows.id],
  }),
}))
