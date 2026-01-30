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
   * system | user | assistant | tool-call | error
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

export const threadsRelations = relations(threads, ({ many }) => ({
  messages: many(threadMessages),
}))

export const threadMessagesRelations = relations(threadMessages, ({ one }) => ({
  thread: one(threads, {
    fields: [threadMessages.threadId],
    references: [threads.id],
  }),
}))
