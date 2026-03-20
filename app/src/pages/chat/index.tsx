import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { ChatProvider, useChatContext } from './ChatProvider'
import { context } from '../../hooks/chatContenxt'
import { ThreadMessageRole } from '@/types'
import {
  useThreadStore,
  type ConversationBlock,
  type ThreadMessage,
} from '@/app/src/store/threadStore'
import { FileText, ListChecks } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ArtifactsDisplay } from './ArtifactsDisplay'
import { PlannersDisplay } from './PlannersDisplay'

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
  const { handleSend } = useChatContext()
  const { buildFromDatabase } = useThreadStore()

  const [openSidePane, setOpenSidePane] = useState(false)

  const [paneType, setPaneType] = useState<'Artifacts' | 'Planners'>('Artifacts')

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const unsub = useThreadStore.subscribe((s) => {
      if (s.streaming) {
        //
        console.log('xxxxabcdefag--->')
        const container = scrollContainerRef.current
        if (!container) return
        container.scrollTop = container.scrollHeight
        if (container.dataset.nearBottom === 'true') {
          //
        }
      }
    })
    return unsub
  }, [])
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceToBottom = scrollHeight - scrollTop - clientHeight

      // 如果距离底部小于等于 100px，就记录一个标记（可以通过 data 属性或者 ref）
      if (distanceToBottom <= 100) {
        container.dataset.nearBottom = 'true'
      } else {
        container.dataset.nearBottom = 'false'
      }
    }

    // 监听滚动事件
    container.addEventListener('scroll', handleScroll)
    // 初始化执行一次
    handleScroll()

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    const firstInput = context.firstInput
    if (firstInput) {
      console.log('firstInput', firstInput)
      context.firstInput = ''
      handleSend(firstInput)
    } else {
      async function fetchMessages() {
        const { blockData, planner, artifacts } = await window.ipcRendererApi.invoke(
          'agent-resume-session',
          {
            sessionId: threadId,
          }
        )
        const lastBlock = blockData.at(-1)
        if (!lastBlock) return

        const lastBlockId = lastBlock.id
        const conversationBlocks: ConversationBlock[] = []
        for (const block of blockData) {
          const conversationBlock: ConversationBlock = {
            id: block.id,
            input: block.userInput,
            // TODO
            status: 'finished',
            askUser: block.askUser,
            // TODO
            runtime: {} as any,
            messages: [],
          }
          const blockMessages = buildBlockMessages(block.messages)
          conversationBlock.messages = blockMessages
          conversationBlocks.push(conversationBlock)
        }
        function buildBlockMessages(messages: (typeof blockData)[number]['messages']) {
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

        const pendingPlanner = planner.find((i) => i.plan.some((i) => i.status !== 'completed'))
        buildFromDatabase({
          sessionId: threadId,
          blocks: conversationBlocks,
          currentBlockId: lastBlockId,
          planner,
          currentPlannerId: pendingPlanner?.id,
          artifacts,
          streaming: false,
        })
      }
      fetchMessages()
    }

    if (context.isRuning) {
      // restore()
    }
  }, [threadId, handleSend, buildFromDatabase])

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <div className='flex h-0 flex-1'>
        <div className='flex h-full min-w-[500px] flex-1 flex-col'>
          <div className='sticky flex h-10 items-center justify-between px-5'>
            <div></div>
            <div className='text-text-secondary flex items-center gap-2'>
              <ListChecks
                size={14}
                className={cn({
                  'text-primary': openSidePane && paneType === 'Planners',
                })}
                onClick={() => {
                  setPaneType('Planners')
                  if (!openSidePane) {
                    setOpenSidePane(true)
                    return
                  }
                  if (paneType === 'Planners') {
                    setOpenSidePane(false)
                    return
                  }
                }}
              ></ListChecks>
              <FileText
                size={14}
                className={cn({
                  'text-primary': openSidePane && paneType === 'Artifacts',
                })}
                onClick={() => {
                  setPaneType('Artifacts')
                  if (!openSidePane) {
                    setOpenSidePane(true)
                    return
                  }
                  if (paneType === 'Artifacts') {
                    setOpenSidePane(false)
                    return
                  }
                }}
              ></FileText>
            </div>
          </div>
          <div className='h-0 flex-1 overflow-auto' ref={scrollContainerRef}>
            <MessageList />

            <div className='h-[200px]'></div>
          </div>
          <ChatInput />
        </div>
        <div
          className={cn('overflow-x-hidden transition-[width] duration-200 ease-out', {
            'w-0': !openSidePane,
            'w-[1000px] border-l': openSidePane && paneType === 'Artifacts',
            'w-[600px] border-l': openSidePane && paneType === 'Planners',
          })}
        >
          {paneType === 'Artifacts' && <ArtifactsDisplay threadId={threadId}></ArtifactsDisplay>}
          {paneType === 'Planners' && <PlannersDisplay></PlannersDisplay>}
        </div>
      </div>
    </div>
  )
}
