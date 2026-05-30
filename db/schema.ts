import { relations } from 'drizzle-orm'
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  type: text('type', { enum: ['normal', 'fork'] })
    .notNull()
    .default('normal'),
  originSessionId: text('origin_session_id').references((): AnySQLiteColumn => sessions.id),
  originWorkflowId: text('origin_workflow_id').references(
    (): AnySQLiteColumn => sessionWorkflows.id
  ),
  workspacePath: text('workspace_path'),
  activeBranch: text('active_branch').notNull().default('main'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessionWorkflows = sqliteTable('session_workflows', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id),
  parentWorkflowId: text('parent_workflow_id').references(
    (): AnySQLiteColumn => sessionWorkflows.id
  ),
  status: text('status', { enum: ['running', 'finished', 'error', 'aborted'] })
    .notNull()
    .default('running'),
  autoApprove: integer('auto_approve', { mode: 'boolean' }).notNull().default(false),
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
    headWorkflowId: text('head_workflow_id').references(() => sessionWorkflows.id),
    sourceWorkflowId: text('source_workflow_id').references(() => sessionWorkflows.id),
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

export const sessionWorkflowMessages = sqliteTable('session_workflow_messages', {
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

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id),
  artifactWorkspaceName: text('artifact_workspace_name').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const planners = sqliteTable('planners', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id),
  planJson: text('plan_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const askUserQuestions = sqliteTable('ask_user_questions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => sessionWorkflows.id),
  draftJson: text('draft_json'),
  answerJson: text('answer_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessionsRelations = relations(sessions, ({ many }) => ({
  workflows: many(sessionWorkflows),
  planners: many(planners),
  sessionBranches: many(sessionBranches),
}))

export const sessionWorkflowsRelations = relations(sessionWorkflows, ({ one, many }) => ({
  session: one(sessions, {
    fields: [sessionWorkflows.sessionId],
    references: [sessions.id],
  }),
  parentWorkflow: one(sessionWorkflows, {
    fields: [sessionWorkflows.parentWorkflowId],
    references: [sessionWorkflows.id],
    relationName: 'workflow_parent_child',
  }),
  childWorkflows: many(sessionWorkflows, {
    relationName: 'workflow_parent_child',
  }),
  sessionWorkflowMessages: many(sessionWorkflowMessages),
  askUserQuestions: one(askUserQuestions),
  sessionBranchesAsHead: many(sessionBranches),
}))

export const sessionBranchesRelations = relations(sessionBranches, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionBranches.sessionId],
    references: [sessions.id],
  }),
  headWorkflow: one(sessionWorkflows, {
    fields: [sessionBranches.headWorkflowId],
    references: [sessionWorkflows.id],
    relationName: 'branch_head_workflow',
  }),
  sourceWorkflow: one(sessionWorkflows, {
    fields: [sessionBranches.sourceWorkflowId],
    references: [sessionWorkflows.id],
    relationName: 'branch_source_workflow',
  }),
}))

export const sessionWorkflowMessagesRelations = relations(sessionWorkflowMessages, ({ one }) => ({
  sessionWorkflow: one(sessionWorkflows, {
    fields: [sessionWorkflowMessages.workflowId],
    references: [sessionWorkflows.id],
  }),
}))

export const plannersRelations = relations(planners, ({ one }) => ({
  sessions: one(sessions, {
    fields: [planners.sessionId],
    references: [sessions.id],
  }),
}))

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  sessions: one(sessions, {
    fields: [artifacts.sessionId],
    references: [sessions.id],
  }),
}))

export const askUserQuestionsRelations = relations(askUserQuestions, ({ one }) => ({
  sessionWorkflow: one(sessionWorkflows, {
    fields: [askUserQuestions.workflowId],
    references: [sessionWorkflows.id],
  }),
}))
