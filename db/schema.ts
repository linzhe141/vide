import { relations } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  title: text('title'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const threadMessages = sqliteTable('thread_messages', {
  id: text('id').primaryKey(),

  threadId: text('thread_id').notNull(),

  /**
   * UI / workflow 语义角色
   * ThreadMessageRole
   */
  role: text('role').notNull(),

  /**
   * 纯文本内容（user / assistant）
   */
  content: text('content'),

  /**
   * tool calls / tool result / error / meta
   * JSON string
   */
  payload: text('payload'),

  createdAt: integer('created_at').notNull(),
})

export const workflowBlocks = sqliteTable('workflow_blocks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  input: text('input').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
  finishedAt: integer('finished_at'),
  activePlanId: text('active_plan_id'),
  activeQuestionId: text('active_question_id'),
  runtimeSnapshot: text('runtime_snapshot'),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  blockId: text('block_id').notNull(),
  role: text('role').notNull(),
  content: text('content'),
  payload: text('payload'),
  createdAt: integer('created_at').notNull(),
})

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  blockId: text('block_id').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const planSteps = sqliteTable('plan_steps', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  seq: integer('seq').notNull(),
  status: text('status').notNull(),
  description: text('description').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const askUserQuestions = sqliteTable('ask_user_questions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  blockId: text('block_id').notNull(),
  status: text('status').notNull(),
  type: text('type').notNull(),
  title: text('title'),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const askUserOptions = sqliteTable('ask_user_options', {
  id: text('id').primaryKey(),
  questionId: text('question_id').notNull(),
  idx: integer('idx').notNull(),
  label: text('label').notNull(),
  value: text('value').notNull(),
  description: text('description'),
})

export const askUserAnswers = sqliteTable('ask_user_answers', {
  id: text('id').primaryKey(),
  questionId: text('question_id').notNull(),
  sessionId: text('session_id').notNull(),
  blockId: text('block_id').notNull(),
  valuesJson: text('values_json').notNull(),
  submittedAt: integer('submitted_at').notNull(),
})

export const threadsRelations = relations(threads, ({ many }) => ({
  messages: many(threadMessages),
}))

export const threadMessagesRelations = relations(threadMessages, ({ one }) => ({
  thread: one(threads, {
    fields: [threadMessages.threadId],
    references: [threads.id],
  }),
}))
