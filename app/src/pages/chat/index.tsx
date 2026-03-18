import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { useEffect, useState } from 'react'
import { ChatProvider, useChatContext } from './ChatProvider'
import { context } from '../../hooks/chatContenxt'
import { useThreadsStore } from '../../store/threadsStore'
import { ThreadMessageRole } from '@/types'
import {
  useThreadStore,
  type ConversationBlock,
  type ThreadMessage,
} from '@/app/src/store/threadStore'
import { FileText } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ArtifactsDisplay } from './ArtifactsDisplay'

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
  const { buildFromDatabase } = useThreadStore()
  const [openArtifacts, setOpenArtifacts] = useState(false)

  useEffect(() => {
    const firstInput = context.firstInput
    if (firstInput) {
      console.log('firstInput', firstInput)
      context.firstInput = ''
      handleSend(firstInput)
    } else {
      async function fetchMessages() {
        const res = await window.ipcRendererApi.invoke('agent-resume-session', {
          sessionId: threadId,
        })
        const lastBlock = res.at(-1)
        if (!lastBlock) return

        const lastBlockId = lastBlock.id
        const conversationBlocks: ConversationBlock[] = []
        for (const block of res) {
          const conversationBlock: ConversationBlock = {
            id: block.id,
            input: block.userInput,
            // TODO
            status: 'finished',
            // TODO
            planner: undefined,
            askUser: block.askUser,
            // TODO
            runtime: {} as any,
            messages: [],
          }
          const blockMessages = buildBlockMessages(block.messages)
          conversationBlock.messages = blockMessages
          conversationBlocks.push(conversationBlock)
        }
        function buildBlockMessages(messages: (typeof res)[number]['messages']) {
          const theadMessages: ThreadMessage[] = []
          for (const message of messages) {
            switch (message.role) {
              case ThreadMessageRole.User: {
                theadMessages.push({
                  role: 'user',
                  id: message.id,
                  content: message.content || '',
                })
                break
              }
              case ThreadMessageRole.AssistantReason: {
                theadMessages.push({
                  role: 'assistant-reason',
                  id: message.id,
                  content: message.content || '',
                })
                break
              }
              case ThreadMessageRole.AssistantText: {
                theadMessages.push({
                  role: 'assistant-text',
                  id: message.id,
                  content: message.content || '',
                })
                break
              }
              case ThreadMessageRole.ToolCalls: {
                theadMessages.push({
                  role: 'tool-call',
                  id: message.id,
                  toolCalls: JSON.parse(message.payload || '[]'),
                })
                break
              }
              case ThreadMessageRole.Tool: {
                const toolResult = JSON.parse(message.payload || '{}') as
                  | { id: string; toolName: string; result: any }
                  | { id: string; toolName: string; error: any }
                theadMessages.push({
                  role: 'tool-result',
                  id: message.id,
                  toolCallId: toolResult.id,
                  result: 'result' in toolResult ? toolResult.result : toolResult.error,
                })
                break
              }
              default: {
                break
              }
            }
          }
          return theadMessages
        }
        buildFromDatabase({
          sessionId: threadId,
          blocks: conversationBlocks,
          currentBlockId: lastBlockId,
        })
      }
      fetchMessages()
    }

    if (context.isRuning) {
      // restore()
    }
  }, [threadId, handleSend, setThreads, buildFromDatabase])

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <div className='flex h-0 flex-1'>
        <div className='flex h-full min-w-[500px] flex-1 flex-col'>
          <div className='sticky flex h-10 items-center justify-between px-5'>
            <div></div>
            <FileText
              className='text-text-secondary'
              onClick={() => {
                setOpenArtifacts((prev) => !prev)
              }}
            ></FileText>
          </div>
          <div className='h-0 flex-1 overflow-auto'>
            <MessageList />
          </div>
          <ChatInput />
        </div>
        <div
          className={cn('transition-[width] duration-200 ease-out', {
            'w-0': !openArtifacts,
            'w-[1000px] border-l': openArtifacts,
          })}
        >
          <ArtifactsDisplay></ArtifactsDisplay>
        </div>
      </div>
    </div>
  )
}
