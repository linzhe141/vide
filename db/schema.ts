import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  activeBranch: text('active_branch').notNull().default('main'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessionWorkflowBlocks = sqliteTable('session_workflow_blocks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id),
  parentBlockId: text('parent_block_id').references((): AnySQLiteColumn => sessionWorkflowBlocks.id),
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
    headBlockId: text('head_block_id').references(() => sessionWorkflowBlocks.id),
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

export const sessionWorkflowBlockMessages = sqliteTable('session_workflow_block_messages', {
  id: text('id').primaryKey(),
  blockId: text('block_id')
    .notNull()
    .references(() => sessionWorkflowBlocks.id),
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
  blockId: text('block_id')
    .notNull()
    .references(() => sessionWorkflowBlocks.id),
  draftJson: text('draft_json'),
  answerJson: text('answer_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessionsRelations = relations(sessions, ({ many }) => ({
  workflowBlocks: many(sessionWorkflowBlocks),
  planners: many(planners),
  sessionBranches: many(sessionBranches),
}))

export const sessionWorkflowBlocksRelations = relations(sessionWorkflowBlocks, ({ one, many }) => ({
  session: one(sessions, {
    fields: [sessionWorkflowBlocks.sessionId],
    references: [sessions.id],
  }),
  parentBlock: one(sessionWorkflowBlocks, {
    fields: [sessionWorkflowBlocks.parentBlockId],
    references: [sessionWorkflowBlocks.id],
    relationName: 'workflow_block_parent_child',
  }),
  childBlocks: many(sessionWorkflowBlocks, {
    relationName: 'workflow_block_parent_child',
  }),
  sessionWorkflowBlockMessages: many(sessionWorkflowBlockMessages),
  askUserQuestions: one(askUserQuestions),
  sessionBranchesAsHead: many(sessionBranches),
}))

export const sessionBranchesRelations = relations(sessionBranches, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionBranches.sessionId],
    references: [sessions.id],
  }),
  headBlock: one(sessionWorkflowBlocks, {
    fields: [sessionBranches.headBlockId],
    references: [sessionWorkflowBlocks.id],
  }),
}))

export const sessionWorkflowBlockMessagesRelations = relations(
  sessionWorkflowBlockMessages,
  ({ one }) => ({
    sessionWorkflowBlock: one(sessionWorkflowBlocks, {
      fields: [sessionWorkflowBlockMessages.blockId],
      references: [sessionWorkflowBlocks.id],
    }),
  })
)

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
  sessionWorkflowBlock: one(sessionWorkflowBlocks, {
    fields: [askUserQuestions.blockId],
    references: [sessionWorkflowBlocks.id],
  }),
}))
