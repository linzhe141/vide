import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { useEffect, useState } from 'react'
import { ChatProvider, useChatContext } from './ChatProvider'
import {
  useThreadStore,
  type ConversationBlock,
  type UserChatMessage,
  type AssistantChatTextMessage,
  type ToolCallsChatMessage,
  type WorkflowErrorChatMessage,
  type AssistantChatReasonMessage,
} from '../../store/threadStore'
import { context } from '../../hooks/chatContenxt'
import { ThreadMessageRole } from '@/types'
import { useThreadsStore } from '../../store/threadsStore'
import { onWorkflowEvent } from '../../hooks/useWorkflowStream'

export function Chat() {
  const params = useParams()
  const id = params.id!
  return (
    <ChatProvider>
      <ChatContent threadId={id} />
    </ChatProvider>
  )
}

function ChatContent({ threadId }: { threadId: string }) {
  const { setThreads } = useThreadsStore()

  const [loading, setLoading] = useState(false)
  const { handleSend } = useChatContext()
  const setBlocks = useThreadStore((data) => data.setBlocks)

  useEffect(() => {
    async function fetchThread() {
      setLoading(true)
      setBlocks([])
      try {
        const [res] = await Promise.all([
          window.ipcRendererApi.invoke('get-threads-item-messages', { threadId }),
          new Promise((resolve) => setTimeout(resolve, 250)),
        ])
        if (res?.length) {
          const messages = res
            .map((i) => {
              switch (i.role) {
                case ThreadMessageRole.User: {
                  return {
                    ...i,
                    role: ThreadMessageRole.User,
                    content: i.content,
                  } as UserChatMessage
                }

                case ThreadMessageRole.AssistantReason: {
                  return {
                    ...i,
                    role: ThreadMessageRole.AssistantReason,
                    content: i.content,
                    reasoning: false,
                  } as AssistantChatReasonMessage
                }

                case ThreadMessageRole.AssistantText: {
                  return {
                    ...i,
                    role: ThreadMessageRole.AssistantText,
                    content: i.content,
                  } as AssistantChatTextMessage
                }
                case ThreadMessageRole.ToolCalls: {
                  return {
                    ...i,
                    role: ThreadMessageRole.ToolCalls,
                    tool_calls: JSON.parse(i.payload).toolCalls,
                  } as ToolCallsChatMessage
                }
                case ThreadMessageRole.Error: {
                  return {
                    ...i,
                    role: ThreadMessageRole.Error,
                    error: i.payload,
                  } as WorkflowErrorChatMessage
                }
              }
            })
            .filter(Boolean)
          // 将消息列表转换为 blocks
          const blocks: ConversationBlock[] = []
          let currentBlock: ConversationBlock | null = null
          let blockIndex = 0

          for (const msg of messages) {
            const message = msg!
            if (message.role === ThreadMessageRole.User) {
              // 完成上一个 block
              if (currentBlock) {
                blocks.push(currentBlock)
              }
              blockIndex += 1
              // 创建新 block
              currentBlock = {
                id: `block-${blockIndex}`,
                userMessage: message,
                messages: [message],
              }
            } else if (currentBlock) {
              // 添加到当前 block
              currentBlock.messages.push(message)
            }
          }
          // 完成最后一个 block
          if (currentBlock) {
            blocks.push(currentBlock)
          }
          setBlocks(blocks)
        }
      } finally {
        setLoading(false)
      }
    }

    const firstInput = context.firstInput
    if (firstInput) {
      console.log('firstInput', firstInput)
      context.firstInput = ''
      handleSend(firstInput)
    } else {
      fetchThread()
    }

    let firstRunning = true
    onWorkflowEvent('workflow-start', async () => {
      if (firstRunning) {
        firstRunning = false
        console.log('xxxx')
        window.ipcRendererApi.invoke('get-threads-list').then((res) => {
          setThreads(res)
        })
      }
    })
  }, [threadId, setBlocks, handleSend, setThreads])

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <MessageList loading={loading} />
      <ChatInput />
    </div>
  )
}
