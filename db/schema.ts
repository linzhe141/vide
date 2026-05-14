import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  title: text('title'),
  activeBranch: text('active_branch').notNull().default('main'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const threadWorkflowBlocks = sqliteTable('thread_workflow_blocks', {
  id: text('id').primaryKey(),
  threadId: text('thread_id')
    .notNull()
    .references(() => threads.id),
  parentBlockId: text('parent_block_id').references((): AnySQLiteColumn => threadWorkflowBlocks.id),
  input: text('input').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessionBranches = sqliteTable(
  'session_branches',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id')
      .notNull()
      .references(() => threads.id),
    name: text('name').notNull(),
    headBlockId: text('head_block_id').references(() => threadWorkflowBlocks.id),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    threadNameUnique: uniqueIndex('session_branches_thread_name_unique').on(
      table.threadId,
      table.name
    ),
  })
)

export const threadWorkflowBlockMessages = sqliteTable('thread_workflow_block_messages', {
  id: text('id').primaryKey(),
  blockId: text('block_id')
    .notNull()
    .references(() => threadWorkflowBlocks.id),
  role: text('role').notNull(),
  content: text('content'),
  payload: text('payload'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  threadId: text('thread_id')
    .notNull()
    .references(() => threads.id),
  artifactWorkspaceName: text('artifact_workspace_name').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const planners = sqliteTable('planners', {
  id: text('id').primaryKey(),
  threadId: text('thread_id')
    .notNull()
    .references(() => threads.id),
  planJson: text('plan_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const askUserQuestions = sqliteTable('ask_user_questions', {
  id: text('id').primaryKey(),
  blockId: text('block_id')
    .notNull()
    .references(() => threadWorkflowBlocks.id),
  draftJson: text('draft_json'),
  answerJson: text('answer_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const threadsRelations = relations(threads, ({ many }) => ({
  workflowBlocks: many(threadWorkflowBlocks),
  planners: many(planners),
  sessionBranches: many(sessionBranches),
}))

export const threadWorkflowBlocksRelations = relations(threadWorkflowBlocks, ({ one, many }) => ({
  thread: one(threads, {
    fields: [threadWorkflowBlocks.threadId],
    references: [threads.id],
  }),
  parentBlock: one(threadWorkflowBlocks, {
    fields: [threadWorkflowBlocks.parentBlockId],
    references: [threadWorkflowBlocks.id],
    relationName: 'workflow_block_parent_child',
  }),
  childBlocks: many(threadWorkflowBlocks, {
    relationName: 'workflow_block_parent_child',
  }),
  threadWorkflowBlockMessages: many(threadWorkflowBlockMessages),
  askUserQuestions: one(askUserQuestions),
  sessionBranchesAsHead: many(sessionBranches),
}))

export const sessionBranchesRelations = relations(sessionBranches, ({ one }) => ({
  thread: one(threads, {
    fields: [sessionBranches.threadId],
    references: [threads.id],
  }),
  headBlock: one(threadWorkflowBlocks, {
    fields: [sessionBranches.headBlockId],
    references: [threadWorkflowBlocks.id],
  }),
}))

export const threadWorkflowBlockMessagesRelations = relations(
  threadWorkflowBlockMessages,
  ({ one }) => ({
    threadWorkflowBlock: one(threadWorkflowBlocks, {
      fields: [threadWorkflowBlockMessages.blockId],
      references: [threadWorkflowBlocks.id],
    }),
  })
)

export const plannersRelations = relations(planners, ({ one }) => ({
  threads: one(threads, {
    fields: [planners.threadId],
    references: [threads.id],
  }),
}))

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  threads: one(threads, {
    fields: [artifacts.threadId],
    references: [threads.id],
  }),
}))

export const askUserQuestionsRelations = relations(askUserQuestions, ({ one }) => ({
  threadWorkflowBlock: one(threadWorkflowBlocks, {
    fields: [askUserQuestions.blockId],
    references: [threadWorkflowBlocks.id],
  }),
}))
