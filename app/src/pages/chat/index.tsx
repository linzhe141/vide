import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { memo, useEffect, useState } from 'react'
import { ChatProvider } from './ChatProvider'
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
    <ChatProvider key={id}>
      <ChatContentMemo key={id} threadId={id} />
    </ChatProvider>
  )
}

function ChatContent({ threadId }: { threadId: string }) {
  const [loading, setLoading] = useState(false)
  const setBlocks = useThreadStore((data) => data.setBlocks)

  useEffect(() => {
    async function fetchThread() {
      setLoading(true)
      setBlocks([])
      try {
        await new Promise((resolve) => setTimeout(resolve, 250))
        const res = await window.ipcRendererApi.invoke('threads-item-messages', { threadId })

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
    // TODO
    // 如果是从 welecome 页面 user-input 发起的workflow，不需要获取thread messages
    // 如何友好的判断 firstInut，现在这个context 已经在 ChatProvider 被 清空了
    if (!context.firstInput) {
      fetchThread()
    }
  }, [threadId, setBlocks])

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <MessageList loading={loading} />
      <ChatInput />
    </div>
  )
}

const ChatContentMemo = memo(ChatContent)
