import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { memo, useEffect, useState } from 'react'
import { ChatProvider } from './ChatProvider'
import {
  useThreadStore,
  type AssistantChatTextMessage,
  type ToolCallChatMessage,
  type WorkflowErrorChatMessage,
} from '../../store/threadStore'
import type { UserChatMessage } from '@/agent/core/types'

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
  const [loading, setLoading] = useState(true)
  const setMessages = useThreadStore((data) => data.setMessages)

  useEffect(() => {
    async function fetchThread() {
      setLoading(true)
      setMessages([])
      try {
        await new Promise((resolve) => setTimeout(resolve, 250))
        const res = await window.ipcRendererApi.invoke('threads-item-messages', { threadId })

        if (res?.length) {
          const result = res.map((i: any) => {
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

          setMessages(result)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchThread()
  }, [threadId, setMessages])

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <MessageList loading={loading} />
      <ChatInput />
    </div>
  )
}

const ChatContentMemo = memo(ChatContent)
