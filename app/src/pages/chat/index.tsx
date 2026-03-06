import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { useEffect } from 'react'
import { ChatProvider, useChatContext } from './ChatProvider'
import { context } from '../../hooks/chatContenxt'
import { useThreadsStore } from '../../store/threadsStore'

export function Chat() {
  const params = useParams()
  const id = params.id!
  return (
    <ChatProvider>
      <ChatContent key={id} threadId={id} />
    </ChatProvider>
  )
}

function ChatContent({ threadId }: { threadId: string }) {
  const { setThreads } = useThreadsStore()

  const { handleSend } = useChatContext()

  useEffect(() => {
    const firstInput = context.firstInput
    if (firstInput) {
      console.log('firstInput', firstInput)
      context.firstInput = ''
      handleSend(firstInput)
    }

    if (context.isRuning) {
      // restore()
    }
  }, [threadId, handleSend, setThreads])

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <MessageList loading={false} />
      <ChatInput />
    </div>
  )
}
