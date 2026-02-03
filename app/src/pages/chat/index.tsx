import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { memo, useEffect, useState } from 'react'
import { ChatProvider, useChatContext } from './ChatProvider'
import {
  useThreadStore,
  type AssistantChatTextMessage,
  type ConversationBlock,
  type ToolCallChatMessage,
  type WorkflowErrorChatMessage,
} from '../../store/threadStore'
import type { UserChatMessage } from '@/agent/core/types'
import { context } from '../../hooks/chatContenxt'

export function Chat() {
  const params = useParams()
  const id = params.id!
  return (
    <ChatProvider>
      <ChatContentMemo threadId={id} />
    </ChatProvider>
  )
}

function ChatContent({ threadId }: { threadId: string }) {
  const [loading, setLoading] = useState(false)
  const { handleSend } = useChatContext()
  const setBlocks = useThreadStore((data) => data.setBlocks)

  useEffect(() => {
    async function fetchThread() {
      setLoading(true)
      setBlocks([])
      try {
        const [res] = await Promise.all([
          window.ipcRendererApi.invoke('threads-item-messages', { threadId }),
          new Promise((resolve) => setTimeout(resolve, 250)),
        ])
        if (res?.length) {
          const messages = res.map((i: any) => {
            switch (i.role) {
              case 'user': {
                return { ...i, role: 'user', content: i.content } as UserChatMessage
              }
              case 'assistant': {
                return {
                  ...i,
                  role: 'assistant',
                  content: i.content,
                } as AssistantChatTextMessage
              }
              case 'tool-call': {
                return {
                  ...i,
                  role: 'tool-call',
                  tool_calls: JSON.parse(i.payload).toolCalls,
                } as ToolCallChatMessage
              }
              case 'error': {
                return { ...i, role: 'error', error: i.payload } as WorkflowErrorChatMessage
              }
              default: {
                return i
              }
            }
          })

          // 将消息列表转换为 blocks
          const blocks: ConversationBlock[] = []
          let currentBlock: ConversationBlock | null = null
          let blockIndex = 0

          for (const message of messages) {
            if (message.role === 'user') {
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
  }, [threadId, setBlocks, handleSend])

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <MessageList loading={loading} />
      <ChatInput />
    </div>
  )
}

const ChatContentMemo = memo(ChatContent)
