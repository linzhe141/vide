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

// Block 代表一个user-input 到 workflow finished 的对话轮次
export type ConversationBlock = {
  id: string
  userMessage: UserChatMessage // 快速的指针引用
  messages: ThreadMessage[] // 包含 user assistant, tool-call, error 等消息
}

type State = {
  threadId: string
  blocks: ConversationBlock[]
  currentBlockIndex: number
}

type Actions = {
  setThreadId: (threadId: string) => void
  setBlocks: (blocks: ConversationBlock[]) => void

  // Block 操作
  startNewBlock: (userMessage: UserChatMessage) => void
  finishCurrentBlock: () => void

  // 消息操作（都是针对当前 block）
  pushMessageToCurrentBlock: (message: ThreadMessage) => void
  updateLLMDeltaMessage: (message: AssistantChatTextMessage) => void
  updateLLMResultMessage: (message: AssistantChatMessage) => void
  updateToolResultMessage: (message: ToolChatMessage) => void

  // 辅助方法
  getCurrentBlock: () => ConversationBlock | undefined
  getAllMessages: () => ThreadMessage[] // 获取所有 block 的所有消息（扁平化）
}

export const useThreadStore = create<State & Actions>((set, get) => ({
  threadId: '',
  blocks: [],
  currentBlockIndex: 0,

  setThreadId: (threadId: string) => set({ threadId }),

  setBlocks: (blocks: ConversationBlock[]) => set({ blocks }),

  startNewBlock: (userMessage: UserChatMessage) => {
    set((state) => {
      const index = state.currentBlockIndex + 1
      const blockId = `block-${index}`
      const newBlock: ConversationBlock = {
        id: blockId,
        userMessage,
        messages: [userMessage],
      }
      return {
        blocks: [...state.blocks, newBlock],
        currentBlockIndex: index,
      }
    })
  },

  finishCurrentBlock: () => {
    set((state) => ({
      blocks: state.blocks.map((block) =>
        block.id === `block-${state.currentBlockIndex}` ? { ...block, isFinished: true } : block
      ),
    }))
  },

  pushMessageToCurrentBlock: (message: ThreadMessage) => {
    set((state) => {
      if (!state.currentBlockIndex) {
        console.warn('No current block to push message to')
        return state
      }

      return {
        blocks: state.blocks.map((block) =>
          block.id === `block-${state.currentBlockIndex}`
            ? { ...block, messages: [...block.messages, message] }
            : block
        ),
      }
    })
  },

  updateLLMDeltaMessage: (message: AssistantChatTextMessage) => {
    set((state) => {
      if (!state.currentBlockIndex) {
        console.warn('No current block to update')
        return state
      }

      return {
        blocks: state.blocks.map((block) => {
          if (block.id !== `block-${state.currentBlockIndex}`) return block

          const lastMessage = block.messages[block.messages.length - 1]

          if (lastMessage?.role !== 'assistant') {
            // 添加新的 assistant 消息
            return {
              ...block,
              messages: [...block.messages, message],
            }
          } else {
            // 更新现有的 assistant 消息
            return {
              ...block,
              messages: [
                ...block.messages.slice(0, -1),
                {
                  ...lastMessage,
                  content: message.content,
                },
              ],
            }
          }
        }),
      }
    })
  },

  updateLLMResultMessage: (message: AssistantChatMessage) => {
    set((state) => {
      if (!state.currentBlockIndex) {
        console.warn('No current block to update')
        return state
      }

      return {
        blocks: state.blocks.map((block) => {
          if (block.id !== `block-${state.currentBlockIndex}`) return block

          const assistantChatTextMessage: AssistantChatTextMessage = {
            role: 'assistant',
            content: message.content as string,
          }

          let toolCallMessage: ToolCallChatMessage | null = null
          if ('tool_calls' in message && message.tool_calls) {
            toolCallMessage = {
              role: 'tool-call',
              // @ts-expect-error ignore
              tool_calls: message.tool_calls,
            }
          }

          const lastMessage = block.messages[block.messages.length - 1]
          const messagesToAdd = [assistantChatTextMessage, toolCallMessage].filter(
            Boolean
          ) as ThreadMessage[]

          if (lastMessage?.role === 'assistant') {
            // 替换最后一条 assistant 消息
            return {
              ...block,
              messages: [...block.messages.slice(0, -1), ...messagesToAdd],
            }
          } else {
            // 追加消息
            return {
              ...block,
              messages: [...block.messages, ...messagesToAdd],
            }
          }
        }),
      }
    })
  },

  updateToolResultMessage: (message: ToolChatMessage) => {
    set((state) => ({
      blocks: state.blocks.map((block) => ({
        ...block,
        messages: block.messages.map((msg) => {
          if (msg.role !== 'tool-call') return msg

          return {
            ...msg,
            tool_calls: msg.tool_calls.map((tool) =>
              tool.id === message.tool_call_id ? { ...tool, result: message } : tool
            ),
          }
        }),
      })),
    }))
  },

  getCurrentBlock: () => {
    const state = get()
    return state.blocks.find((block) => block.id === `block-${state.currentBlockIndex}`)
  },

  getAllMessages: () => {
    const state = get()
    return state.blocks.flatMap((block) => [...block.messages])
  },
}))
