import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { useEffect } from 'react'
import { useThreadsStore } from '@/app/src/store/threadsStore'
import {
  useThreadStore,
  type ConversationBlock,
  type ThreadMessage,
} from '@/app/src/store/threadStore'
import { ThreadMessageRole } from '@/types'

export function ThreadRecents() {
  const { threads, setThreads } = useThreadsStore()
  const { buildFromDatabase } = useThreadStore()
  useEffect(() => {
    async function fetchChats() {
      const res = await window.ipcRendererApi.invoke('get-threads-list')
      const result = res
      setThreads(result)
    }
    fetchChats()
  }, [setThreads])

  return (
    <div className='flex flex-1 flex-col gap-0.5 overflow-y-auto px-2'>
      {threads.map((thread) => (
        <NavLink
          key={thread.id}
          to={`/chat/${thread.id}`}
          onClick={async () => {
            const res = await window.ipcRendererApi.invoke('agent-resume-session', {
              sessionId: thread.id,
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
              sessionId: thread.id,
              blocks: conversationBlocks,
              currentBlockId: lastBlockId,
            })
          }}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5',
              'text-sm',
              'text-text-secondary',
              'transition-colors',
              'hover:bg-foreground/5 hover:text-foreground',
              isActive && 'bg-foreground/8 text-foreground font-medium'
            )
          }
        >
          <span className='block truncate'>{thread.title || 'Untitled'}</span>
        </NavLink>
      ))}

      {threads.length === 0 && (
        <div className='text-text-info px-3 py-4 text-sm'>No active threads</div>
      )}
    </div>
  )
}
