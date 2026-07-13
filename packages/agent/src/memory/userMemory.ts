import fs from 'node:fs/promises'
import path from 'node:path'
import type { AI, ChatMessage } from '@vide/ai'
import { DEFAULT_VIDE_HOME } from '../workspace'

export type UserMemory = {
  [key: string]: unknown
  metadata?: {
    createdAt: string
    updatedAt: string
    updateCount: number
  }
}

const USER_MEMORY_DIR = path.join(DEFAULT_VIDE_HOME, 'memory')
const USER_MEMORY_FILE = path.join(USER_MEMORY_DIR, 'user.json')
const MAX_MESSAGE_CHARS = 12000
const MAX_TOOL_CALL_RETRIES = 2
const SUBMIT_USER_MEMORY_TOOL_NAME = 'submit_user_memory'

export type UserMemoryFeedback = {
  rating: 'manual' | 'like' | 'dislike'
  reason?: string
}

export function getUserMemoryFilePath() {
  return USER_MEMORY_FILE
}

export async function readUserMemory(): Promise<UserMemory | null> {
  try {
    const raw = await fs.readFile(USER_MEMORY_FILE, 'utf8')
    const parsed = JSON.parse(raw) as UserMemory
    return parsed
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null
    console.warn('Failed to read user memory:', error)
    return null
  }
}

export async function buildUserMemoryChatMessage(): Promise<ChatMessage | null> {
  const memory = await readUserMemory()
  if (!memory) return null

  return {
    role: 'system',
    content: `User memory from previous conversations:\n${JSON.stringify(stripMemoryMetadata(memory), null, 2)}`,
  }
}

export async function updateUserMemoryFromConversation(options: {
  messages: ChatMessage[]
  llmClient: AI | null
  model: string | null
  feedback?: UserMemoryFeedback
}) {
  const currentMemory = await readUserMemory()
  if (!options.llmClient || !options.model) return

  const now = new Date().toISOString()
  const conversation = serializeRecentConversation(options.messages)
  if (!conversation.length && !options.feedback) return

  const submittedMemory = await callUserMemoryTool({
    llmClient: options.llmClient,
    model: options.model,
    currentMemory,
    conversation,
    feedback: options.feedback,
  })
  const updatedMemory = withMemoryMetadata(submittedMemory, currentMemory, now)
  await writeUserMemory(updatedMemory)
}

async function callUserMemoryTool(options: {
  llmClient: AI
  model: string
  currentMemory: UserMemory | null
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>
  feedback?: UserMemoryFeedback
}) {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'You update a persistent user memory JSON file for an AI coding assistant.',
        'Extract only stable user preferences that are useful in future conversations.',
        'Focus on coding habits, main tech stack, preferred natural language, and personal interests unrelated to coding.',
        'Use like/dislike feedback to infer response style preferences and what the user wants more or less of.',
        'Do not store secrets, credentials, private keys, one-off task details, or sensitive personal data.',
        `You must call the ${SUBMIT_USER_MEMORY_TOOL_NAME} tool with the updated memory.`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          existingMemory: options.currentMemory ? stripMemoryMetadata(options.currentMemory) : null,
          currentConversation: options.conversation,
          userFeedback: options.feedback ?? null,
        },
        null,
        2
      ),
    },
  ]

  let lastError: unknown = null

  for (let attempt = 0; attempt <= MAX_TOOL_CALL_RETRIES; attempt++) {
    const response = await options.llmClient.chat.completions.create({
      model: options.model,
      stream: false,
      temperature: 0,
      messages,
      tools: [USER_MEMORY_TOOL],
      tool_choice: {
        type: 'function',
        function: { name: SUBMIT_USER_MEMORY_TOOL_NAME },
      },
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.find(
      (item) => item.type === 'function' && item.function.name === SUBMIT_USER_MEMORY_TOOL_NAME
    )

    if (!toolCall || toolCall.type !== 'function') {
      lastError = new Error(`Missing ${SUBMIT_USER_MEMORY_TOOL_NAME} tool call.`)
    } else {
      try {
        return JSON.parse(toolCall.function.arguments)
      } catch (error) {
        lastError = error
      }
    }

    messages.push({
      role: 'user',
      content: [
        'The previous response did not provide valid tool call JSON arguments.',
        `Error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        `Retry by calling ${SUBMIT_USER_MEMORY_TOOL_NAME} with valid JSON arguments only.`,
      ].join('\n'),
    })
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const USER_MEMORY_TOOL = {
  type: 'function' as const,
  function: {
    name: SUBMIT_USER_MEMORY_TOOL_NAME,
    description: 'Submit the updated persistent user memory JSON.',
    parameters: {
      type: 'object',
      properties: {
        preferredLanguages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Natural languages the user prefers, such as Chinese or English.',
        },
        codingHabits: {
          type: 'array',
          items: { type: 'string' },
          description: 'Stable coding style, workflow, or implementation preferences.',
        },
        techStack: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Frameworks, languages, libraries, tools, or platforms the user commonly uses.',
        },
        personalInterests: {
          type: 'array',
          items: { type: 'string' },
          description: 'Durable non-coding hobbies or interests.',
        },
        notes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Other durable, non-sensitive user preferences.',
        },
      },
      required: ['preferredLanguages', 'codingHabits', 'techStack', 'personalInterests', 'notes'],
      additionalProperties: false,
    },
  },
}

async function writeUserMemory(memory: UserMemory) {
  await fs.mkdir(USER_MEMORY_DIR, { recursive: true })
  const tempFile = `${USER_MEMORY_FILE}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempFile, `${JSON.stringify(memory, null, 2)}\n`, 'utf8')
  await fs.rename(tempFile, USER_MEMORY_FILE)
}

function serializeRecentConversation(messages: ChatMessage[]) {
  const serialized: Array<{ role: 'user' | 'assistant'; content: string }> = []
  let remainingChars = MAX_MESSAGE_CHARS

  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue
    const content = stringifyContent(message.content).trim()
    if (!content) continue
    if (remainingChars <= 0) break

    const truncatedContent = content.slice(0, remainingChars)
    serialized.push({
      role: message.role,
      content: truncatedContent,
    })
    remainingChars -= truncatedContent.length
  }

  return serialized
}

function stringifyContent(content: ChatMessage['content']) {
  if (typeof content === 'string') return content
  if (!content) return ''
  return JSON.stringify(content)
}

function withMemoryMetadata(
  memory: UserMemory,
  currentMemory: UserMemory | null,
  now: string
): UserMemory {
  return {
    ...memory,
    metadata: {
      createdAt: currentMemory?.metadata?.createdAt || now,
      updatedAt: now,
      updateCount: (currentMemory?.metadata?.updateCount || 0) + 1,
    },
  }
}

function stripMemoryMetadata(memory: UserMemory) {
  const { metadata: _metadata, ...content } = memory
  return content
}
