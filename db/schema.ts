import { relations } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),

  title: text('title'),

  createdAt: integer('created_at').notNull(),

  updatedAt: integer('updated_at').notNull(),
})

export const threadWorkflowBlocks = sqliteTable('thread_workflow_blocks', {
  id: text('id').primaryKey(),

  threadId: text('thread_id')
    .notNull()
    .references(() => threads.id),

  /**
   * 用户输入
   */
  input: text('input').notNull(),

  createdAt: integer('created_at').notNull(),

  updatedAt: integer('updated_at').notNull(),
})

export const threadWorkflowBlockMessages = sqliteTable('thread_workflow_block_messages', {
  id: text('id').primaryKey(),

  blockId: text('block_id')
    .notNull()
    .references(() => threadWorkflowBlocks.id),

  /**
   * ThreadMessageRole
   */
  role: text('role').notNull(),

  /**
   * 纯文本
   */
  content: text('content'),

  /**
   * toolcall / tool result
   */
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

  /**
   * planner steps JSON
   */
  planJson: text('plan_json'),

  createdAt: integer('created_at').notNull(),

  updatedAt: integer('updated_at').notNull(),
})

export const askUserQuestions = sqliteTable('ask_user_questions', {
  id: text('id').primaryKey(),

  blockId: text('block_id')
    .notNull()
    .references(() => threadWorkflowBlocks.id),

  /**
   * AskUserQuestionDraft
   */
  draftJson: text('draft_json'),

  /**
   * 用户提交的答案
   */
  answerJson: text('answer_json'),

  createdAt: integer('created_at').notNull(),

  updatedAt: integer('updated_at').notNull(),
})

export const threadsRelations = relations(threads, ({ many }) => ({
  workflowBlocks: many(threadWorkflowBlocks),
  planners: many(planners),
}))

export const threadWorkflowBlocksRelations = relations(threadWorkflowBlocks, ({ one, many }) => ({
  thread: one(threads, {
    fields: [threadWorkflowBlocks.threadId],
    references: [threads.id],
  }),

  threadWorkflowBlockMessages: many(threadWorkflowBlockMessages),

  // user submit 后就是下一个workflow
  askUserQuestions: one(askUserQuestions),
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
