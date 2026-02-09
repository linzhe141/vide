import type { ToolCall, ToolChatMessage, AssistantChatMessage } from '@/agent/core/types'
import { ThreadMessageRole } from '@/types'
import { create } from 'zustand'

export type UserChatMessage = {
  role: ThreadMessageRole.User
  content: string
}

export type AssistantChatReasonMessage = {
  reasoning: boolean
  role: ThreadMessageRole.AssistantReason
  content: string
}

export type AssistantChatTextMessage = {
  role: ThreadMessageRole.AssistantText
  content: string
}

export type ToolCallsChatMessage = {
  role: ThreadMessageRole.ToolCalls
  tool_calls: Array<ToolCall & { result?: string }>
}

export type WorkflowErrorChatMessage = {
  role: ThreadMessageRole.Error
  error: any
}

type ThreadMessage =
  | UserChatMessage
  | AssistantChatReasonMessage
  | AssistantChatTextMessage
  | ToolCallsChatMessage
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
  addToolcallName: (data: { toolCallName: string; toolCallId: string }) => void
  addToolcallArguments: (data: { toolArguments: string; toolCallId: string }) => void
  addStartReasonMessage: () => void
  addDeltaReasonMessage: (data: { reasonContent: string }) => void
  addEndReasonMessage: () => void

  // 辅助方法
  getCurrentBlock: () => ConversationBlock | undefined
  getAllMessages: () => ThreadMessage[] // 获取所有 block 的所有消息（扁平化）
}

export const useThreadStore = create<State & Actions>((set, get) => ({
  threadId: '',
  blocks: [],
  currentBlockIndex: 0,

  setThreadId: (threadId: string) => set({ threadId }),

  setBlocks: (blocks: ConversationBlock[]) => {
    set({ blocks })
  },

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

          if (lastMessage?.role !== ThreadMessageRole.AssistantText) {
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
            role: ThreadMessageRole.AssistantText,
            content: message.content as string,
          }

          let toolCallMessage: ToolCallsChatMessage | null = null
          if ('tool_calls' in message && message.tool_calls) {
            toolCallMessage = {
              role: ThreadMessageRole.ToolCalls,
              // @ts-expect-error ignore
              tool_calls: message.tool_calls,
            }
          }

          const lastMessage = block.messages[block.messages.length - 1]
          const messagesToAdd = [assistantChatTextMessage, toolCallMessage].filter(
            Boolean
          ) as ThreadMessage[]

          if (lastMessage?.role === ThreadMessageRole.AssistantText) {
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
          if (msg.role !== ThreadMessageRole.ToolCalls) return msg

          return {
            ...msg,
            tool_calls: msg.tool_calls.map((tool) =>
              tool.id === message.tool_call_id
                ? { ...tool, result: message.content as string }
                : tool
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

  addToolcallName: ({ toolCallName, toolCallId }) => {
    set((state) => {
      if (!state.currentBlockIndex) {
        console.warn('No current block to update')
        return state
      }

      return {
        blocks: state.blocks.map((block) => {
          if (block.id !== `block-${state.currentBlockIndex}`) return block

          const lastMessage = block.messages[block.messages.length - 1]
          if (
            lastMessage?.role === ThreadMessageRole.User ||
            lastMessage?.role === ThreadMessageRole.AssistantText ||
            lastMessage?.role === ThreadMessageRole.AssistantReason
          ) {
            // 第一个 toolCall
            const toolCallMessage: ToolCallsChatMessage = {
              role: ThreadMessageRole.ToolCalls,
              tool_calls: [
                {
                  type: 'function',
                  id: toolCallId,
                  function: { arguments: '', name: toolCallName },
                },
              ],
            }
            return {
              ...block,
              messages: [...block.messages, toolCallMessage],
            }
          } else if (lastMessage?.role === ThreadMessageRole.ToolCalls) {
            // 追加消息
            lastMessage.tool_calls = [
              ...lastMessage.tool_calls,
              {
                type: 'function',
                id: toolCallId,
                function: { arguments: '', name: toolCallName },
              },
            ]
            return {
              ...block,
              messages: [...block.messages.slice(0, -1), lastMessage],
            }
          } else {
            return block
          }
        }),
      }
    })
  },

  addToolcallArguments: ({ toolArguments, toolCallId }) => {
    set((state) => {
      if (!state.currentBlockIndex) {
        console.warn('No current block to update')
        return state
      }

      return {
        blocks: state.blocks.map((block) => {
          if (block.id !== `block-${state.currentBlockIndex}`) return block

          const lastMessage = block.messages[block.messages.length - 1]
          if (lastMessage?.role === ThreadMessageRole.ToolCalls) {
            // 追加消息
            lastMessage.tool_calls = lastMessage.tool_calls.map((i) => {
              if (i.id === toolCallId) {
                i.function.arguments = toolArguments
              }
              return i
            })
            return {
              ...block,
              messages: [...block.messages.slice(0, -1), lastMessage],
            }
          } else {
            return block
          }
        }),
      }
    })
  },
  addStartReasonMessage: () => {
    set((state) => {
      if (!state.currentBlockIndex) {
        console.warn('No current block to update')
        return state
      }

      return {
        blocks: state.blocks.map((block) => {
          if (block.id !== `block-${state.currentBlockIndex}`) return block

          return {
            ...block,
            messages: [
              ...block.messages,
              {
                role: ThreadMessageRole.AssistantReason,
                reasoning: true,
                content: '',
              },
            ],
          }
        }),
      }
    })
  },
  addDeltaReasonMessage: ({ reasonContent }) => {
    set((state) => {
      if (!state.currentBlockIndex) {
        console.warn('No current block to update')
        return state
      }

      return {
        blocks: state.blocks.map((block) => {
          if (block.id !== `block-${state.currentBlockIndex}`) return block

          const lastMessage = block.messages[block.messages.length - 1]

          if (lastMessage?.role === ThreadMessageRole.AssistantReason) {
            // 添加新的 assistant 消息
            return {
              ...block,
              messages: [
                ...block.messages.slice(0, -1),
                {
                  ...lastMessage,
                  content: reasonContent,
                },
              ],
            }
          } else {
            return block
          }
        }),
      }
    })
  },
  addEndReasonMessage: () => {
    set((state) => {
      if (!state.currentBlockIndex) {
        console.warn('No current block to update')
        return state
      }

      return {
        blocks: state.blocks.map((block) => {
          if (block.id !== `block-${state.currentBlockIndex}`) return block

          const lastMessage = block.messages[block.messages.length - 1]

          if (lastMessage?.role === ThreadMessageRole.AssistantReason) {
            // 添加新的 assistant 消息
            return {
              ...block,
              messages: [
                ...block.messages.slice(0, -1),
                {
                  ...lastMessage,
                  reasoning: false,
                },
              ],
            }
          } else {
            return block
          }
        }),
      }
    })
  },
}))
