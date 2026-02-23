import type { ToolCall, ToolChatMessage, AssistantChatMessage } from '@/agent/core/types'
import { ThreadMessageRole } from '@/types'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

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
  tool_calls: Array<ToolCall & { result?: string; status: 'pending' | 'approve' | 'reject' }>
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
  userMessage: UserChatMessage
  // 快速的指针引用
  messages: ThreadMessage[]
  // 包含 user assistant, tool-call, error 等消息
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
  setToolCallStatus: (data: { status: 'approve' | 'reject'; toolCallId: string }) => void
  // 辅助方法
  getCurrentBlock: () => ConversationBlock | undefined
  getAllMessages: () => ThreadMessage[]
  // 获取所有 block 的所有消息（扁平化）
}

export const useThreadStore = create<State & Actions>()(
  immer((set, get) => ({
    threadId: '',
    blocks: [],
    currentBlockIndex: 0,

    setThreadId: (threadId: string) => {
      set((state: State) => {
        state.threadId = threadId
      })
    },

    setBlocks: (blocks: ConversationBlock[]) => {
      set((state: State) => {
        state.blocks = blocks
      })
    },

    startNewBlock: (userMessage: UserChatMessage) => {
      set((state: State) => {
        const index = state.currentBlockIndex + 1
        const blockId = `block-${index}`
        const newBlock: ConversationBlock = {
          id: blockId,
          userMessage,
          messages: [userMessage],
        }
        state.blocks.push(newBlock)
        state.currentBlockIndex = index
      })
    },

    finishCurrentBlock: () => {
      set((state: State) => {
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (block) {
          ;(block as any).isFinished = true
        }
      })
    },

    pushMessageToCurrentBlock: (message: ThreadMessage) => {
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to push message to')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (block) {
          block.messages.push(message)
        }
      })
    },

    updateLLMDeltaMessage: (message: AssistantChatTextMessage) => {
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to update')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (!block) return

        const lastMessage = block.messages[block.messages.length - 1]
        if (lastMessage?.role !== ThreadMessageRole.AssistantText) {
          // 添加新的 assistant 消息
          block.messages.push(message)
        } else {
          // 更新现有的 assistant 消息
          ;(lastMessage as AssistantChatTextMessage).content = message.content
        }
      })
    },

    updateLLMResultMessage: (message: AssistantChatMessage) => {
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to update')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (!block) return

        const lastMessage = block.messages[block.messages.length - 1]

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

        const messagesToAdd = [assistantChatTextMessage, toolCallMessage].filter(
          Boolean
        ) as ThreadMessage[]

        if (lastMessage?.role === ThreadMessageRole.AssistantText) {
          // 替换最后一条 assistant 消息
          block.messages.splice(block.messages.length - 1, 1, ...messagesToAdd)
        } else {
          // 追加消息
          block.messages.push(...messagesToAdd)
        }
      })
    },

    updateToolResultMessage: (message: ToolChatMessage) => {
      set((state: State) => {
        for (const block of state.blocks) {
          for (const msg of block.messages) {
            if (msg.role === ThreadMessageRole.ToolCalls) {
              for (const tool of msg.tool_calls) {
                if (tool.id === message.tool_call_id) {
                  tool.result = message.content as string
                }
              }
            }
          }
        }
      })
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
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to update')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (!block) return

        const lastMessage = block.messages[block.messages.length - 1]
        const newToolCall = {
          type: 'function' as const,
          id: toolCallId,
          function: { arguments: '', name: toolCallName },
          status: 'pending' as const,
        }

        if (
          lastMessage?.role === ThreadMessageRole.User ||
          lastMessage?.role === ThreadMessageRole.AssistantText ||
          lastMessage?.role === ThreadMessageRole.AssistantReason
        ) {
          // 第一个 toolCall
          const toolCallMessage: ToolCallsChatMessage = {
            role: ThreadMessageRole.ToolCalls,
            tool_calls: [newToolCall],
          }
          block.messages.push(toolCallMessage)
        } else if (lastMessage?.role === ThreadMessageRole.ToolCalls) {
          // 追加到现有消息
          ;(lastMessage as ToolCallsChatMessage).tool_calls.push(newToolCall)
        }
      })
    },

    addToolcallArguments: ({ toolArguments, toolCallId }) => {
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to update')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (!block) return

        const lastMessage = block.messages[block.messages.length - 1]
        if (lastMessage?.role === ThreadMessageRole.ToolCalls) {
          for (const toolCall of lastMessage.tool_calls) {
            if (toolCall.id === toolCallId) {
              toolCall.function.arguments = toolArguments
            }
          }
        }
      })
    },

    addStartReasonMessage: () => {
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to update')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (!block) return

        block.messages.push({
          role: ThreadMessageRole.AssistantReason,
          reasoning: true,
          content: '',
        })
      })
    },

    addDeltaReasonMessage: ({ reasonContent }) => {
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to update')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (!block) return

        const lastMessage = block.messages[block.messages.length - 1]
        if (lastMessage?.role === ThreadMessageRole.AssistantReason) {
          ;(lastMessage as AssistantChatReasonMessage).content = reasonContent
        }
      })
    },

    addEndReasonMessage: () => {
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to update')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (!block) return

        const lastMessage = block.messages[block.messages.length - 1]
        if (lastMessage?.role === ThreadMessageRole.AssistantReason) {
          ;(lastMessage as AssistantChatReasonMessage).reasoning = false
        }
      })
    },

    setToolCallStatus: ({ status, toolCallId }) => {
      set((state: State) => {
        if (!state.currentBlockIndex) {
          console.warn('No current block to update')
          return
        }
        const block = state.blocks.find((b) => b.id === `block-${state.currentBlockIndex}`)
        if (!block) return

        const lastMessage = block.messages[block.messages.length - 1]
        if (lastMessage?.role === ThreadMessageRole.ToolCalls) {
          for (const toolCall of lastMessage.tool_calls) {
            if (toolCall.id === toolCallId) {
              ;(toolCall as any).status = status
            }
          }
        }
      })
    },
  }))
)
