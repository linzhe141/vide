import type {
  ToolCall,
  ToolChatMessage,
  UserChatMessage,
  AssistantChatMessage,
} from '@/agent/core/types'
import { create } from 'zustand'

export type AssistantChatTextMessage = {
  role: 'assistant'
  content: string
}

export type ToolCallChatMessage = {
  role: 'tool-call'
  tool_calls: Array<ToolCall & { result?: ToolChatMessage }>
}

export type WorkflowErrorChatMessage = {
  role: 'error'
  error: any
}

type ThreadMessage =
  | UserChatMessage
  | AssistantChatTextMessage
  | ToolCallChatMessage
  | WorkflowErrorChatMessage

type State = {
  threadId: string
  messages: ThreadMessage[]
}

type Actions = {
  setThreadId: (threadId: string) => void
  setMessages: (data: ThreadMessage[]) => void
  pushMessage: (message: ThreadMessage) => void

  updateLLMDeltaMessage: (message: AssistantChatTextMessage) => void
  updateLLMResultMessage: (message: AssistantChatMessage) => void

  updateToolResultMessage: (message: ToolChatMessage) => void
}

export const useThreadStore = create<State & Actions>((set) => ({
  threadId: '',
  setThreadId: (threadId: string) => set({ threadId }),

  messages: [],
  setMessages: (data) => set({ messages: data }),
  pushMessage: (message: ThreadMessage) => {
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  updateLLMDeltaMessage: (message: AssistantChatTextMessage) => {
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1]
      if (lastMessage.role !== 'assistant') {
        const prevMessages = state.messages
        return { messages: [...prevMessages, message] }
      } else {
        const needUpdatedMessage = lastMessage as AssistantChatTextMessage
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
    })
  },

  updateLLMResultMessage: (message: AssistantChatMessage) => {
    set((state) => {
      const assistantChatTextMessage: AssistantChatTextMessage = {
        role: 'assistant',
        content: message.content as string,
      }
      let toolCalls: ToolCall[] = []
      let toolCallMessage: ToolCallChatMessage | null = null
      if ('tool_calls' in message) {
        // @ts-expect-error ignore
        toolCalls = message.tool_calls! || []
        toolCallMessage = {
          role: 'tool-call',
          tool_calls: toolCalls,
        }
      }

      const lastMessage = state.messages[state.messages.length - 1]
      if (lastMessage.role === 'assistant') {
        const prevMessages = state.messages.slice(0, -1)

        return {
          messages: [...prevMessages, assistantChatTextMessage, toolCallMessage].filter(
            Boolean
          ) as ThreadMessage[],
        }
      } else {
        return {
          messages: [...state.messages, assistantChatTextMessage, toolCallMessage].filter(
            Boolean
          ) as ThreadMessage[],
        }
      }
    })
  },

  updateToolResultMessage: (message) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.role !== 'tool-call') return msg

        return {
          ...msg,
          tool_calls: msg.tool_calls.map((tool) =>
            tool.id === message.tool_call_id ? { ...tool, result: message } : tool
          ),
        }
      }),
    }))
  },
}))
