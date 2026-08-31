import { v4 as nanoid } from 'uuid'
import type { AskQuestionOption, AskUserQuestionItem } from './types'

/** ask-user-question 工具的（llm tool call）名字。 */
export const ASK_USER_QUESTION_TOOL_NAME = 'ask-user-question-generate'

/** 提交答案的 user 消息顶层 type（结构化 JSON，load 时据此回填匹配。 */
export const ASK_QUESTION_ANSWER_TYPE = 'ask-user-question-answer'

/** 提交答案的 user 消息结构化 payload 形状。 */
export type AskQuestionAnswerPayload = {
  type: typeof ASK_QUESTION_ANSWER_TYPE
  sessionId: string
  workflowId: string
  messageId: string
  toolCallId: string
  content: string
  answers: {
    questionId: string
    title: string
    selected: string
    other?: string
  }[]
}

export function parseAskQuestionAnswerPayload(content: string): AskQuestionAnswerPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const payload = parsed as Partial<AskQuestionAnswerPayload>
  if (payload.type !== ASK_QUESTION_ANSWER_TYPE || !Array.isArray(payload.answers)) return null
  return payload as AskQuestionAnswerPayload
}

/** 清洗 LLM 输出的 questions 数组，产出符合 UI 类型的 AskUserQuestionItem。 */
export function sanitizeAskUserQuestions(
  questions: unknown,
  options?: { createId?: (index: number) => string }
): AskUserQuestionItem[] {
  if (!Array.isArray(questions)) return []

  const normalized = questions
    .map((item, index): AskUserQuestionItem | null => {
      if (!item || typeof item !== 'object') return null
      const question = item as {
        id?: unknown
        title?: unknown
        description?: unknown
        options?: unknown
        answer?: unknown
      }
      const id =
        typeof question.id === 'string' && question.id.trim()
          ? question.id.trim()
          : (options?.createId?.(index) ?? nanoid())
      const title = typeof question.title === 'string' ? question.title.trim() : ''
      const description =
        typeof question.description === 'string' ? question.description.trim() : ''
      const normalizedOptions = sanitizeAskQuestionOptions(question.options)
      if (!title || !normalizedOptions.length) return null
      const result: AskUserQuestionItem = {
        id,
        title,
        options: normalizedOptions,
        answer: null,
      }
      if (description) result.description = description
      return result
    })
    .filter((item): item is AskUserQuestionItem => item !== null)

  return normalized
}

/** 清洗单个 question 的 options 数组。 */
function sanitizeAskQuestionOptions(options: unknown): AskQuestionOption[] {
  if (!Array.isArray(options)) return []

  const normalized = options
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const label =
        typeof (item as { label?: unknown }).label === 'string'
          ? (item as { label: string }).label.trim()
          : ''
      const value =
        typeof (item as { value?: unknown }).value === 'string'
          ? (item as { value: string }).value.trim()
          : ''
      if (!label || !value) return null
      return { label, value }
    })
    .filter((item): item is AskQuestionOption => item !== null)

  return normalized
}
