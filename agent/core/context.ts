import type { ChatMessage } from './types'

export class AgentContext {
  userInput: string | null = null
  messages: ChatMessage[] = []
}
