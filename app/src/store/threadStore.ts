import type { AssistantChatMessage, ChatMessage, ToolCall } from '@/agent/core/types'
import { create } from 'zustand'

type ThreadMessage = ChatMessage
type State = {
  threadId: string
  messages: ThreadMessage[]
}

type Actions = {
  setThreadId: (threadId: string) => void
  setMessages: (data: ThreadMessage[]) => void
  pushMessage: (message: ThreadMessage) => void
  updateLLMDeltaMessage: (message: ThreadMessage) => void
  updateLLMResultMessage: (message: AssistantChatMessage) => void
}

export const useThreadStore = create<State & Actions>((set) => ({
  threadId: '',
  setThreadId: (threadId: string) => set({ threadId }),

  messages: [],
  setMessages: (data) => set({ messages: data }),
  pushMessage: (message: ThreadMessage) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  updateLLMDeltaMessage: (message: ThreadMessage) =>
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1]
      if (lastMessage.role !== 'assistant') {
        const prevMessages = state.messages
        return { messages: [...prevMessages, message] }
      } else {
        const needUpdatedMessage = lastMessage as AssistantChatMessage
        return {
          messages: [
            ...state.messages.slice(0, -1),
            {
              ...needUpdatedMessage,
              content: message.content as string,
            },
          ],
        }
      }
    }),
  updateLLMResultMessage: (message: AssistantChatMessage) =>
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1]
      if (lastMessage.role === 'assistant') {
        const prevMessages = state.messages.slice(0, -1)
        let toolCalls: ToolCall[] = []
        if ('tool_calls' in message) {
          // @ts-expect-error todo type
          toolCalls = message.tool_calls! || []
        }
        const newLastMessage: AssistantChatMessage = { ...lastMessage }
        newLastMessage.content = message.content
        if (toolCalls.length > 0) {
          newLastMessage.tool_calls = toolCalls
        }
        return { messages: [...prevMessages, newLastMessage] }
      } else {
        return {
          messages: [...state.messages, message as AssistantChatMessage],
        }
      }
    }),
}))
