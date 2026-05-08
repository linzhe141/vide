import { useState } from 'react'
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Ellipsis,
  SquareTerminal,
  XCircle,
} from 'lucide-react'
import type { ToolCall } from '@/agent/core/types'
import { ASK_USER_NAMESPACE } from '@/agent/core/tools/askUserQuestion'
import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
import {
  useThreadBlocks,
  type ConversationBlock,
  type ThreadMessage,
} from '../../store/threadStore'
import { useChatContext } from './ChatProvider'
import { AskUserQuestionView } from './AskUserQuestionView'

function formatDuration(durationMs?: number) {
  if (!durationMs) return null
  if (durationMs < 1000) return `${durationMs}ms`

  const seconds = durationMs / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`

  return `${Math.round(seconds)}s`
}

function getToolLabel(name: string) {
  const last = name.split('.').at(-1) ?? name
  return last.replace(/[-_]/g, ' ')
}

function MessageView({ block, message }: { block: ConversationBlock; message: ThreadMessage }) {
  switch (message.role) {
    case 'user':
      return (
        <div className='flex justify-end'>
          <div className='bg-foreground text-background border-foreground/10 dark:border-foreground/5 max-w-[min(78%,680px)] rounded-[24px] rounded-tr-md border px-5 py-3 text-[15px] leading-7 shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)]'>
            <MarkdownRenderer animation={false} className='text-inherit'>
              {message.content}
            </MarkdownRenderer>
          </div>
        </div>
      )

    case 'assistant-text':
      return (
        <div className='max-w-none'>
          <MarkdownRenderer
            animation
            className='text-foreground prose prose-sm dark:prose-invert max-w-none text-[17px] leading-8'
          >
            {message.content}
          </MarkdownRenderer>
        </div>
      )

    case 'assistant-reason':
      return <ReasoningPanel message={message} block={block} />

    case 'tool-call':
      return <ToolCallView block={block} message={message} />

    case 'tool-result':
      return null

    case 'ask-user':
      return <AskUserQuestionView blockId={block.id} message={message} />

    case 'error':
      return (
        <div className='rounded-[24px] border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-600 dark:text-red-400'>
          <MarkdownRenderer animation={false}>
            {JSON.stringify(message.error, null, 2)}
          </MarkdownRenderer>
        </div>
      )
  }
}

function ReasoningPanel({
  block,
  message,
}: {
  block: ConversationBlock
  message: Extract<ThreadMessage, { role: 'assistant-reason' }>
}) {
  const isRunning = block.runtime.isStreaming && block.messages.at(-1)?.id === message.id
  const [open, setOpen] = useState(isRunning)

  if (!message.reasoning.trim()) return null

  return (
    <div className='space-y-4 text-xs'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='text-text-secondary flex items-center gap-3 font-medium'
      >
        <Brain size={16} strokeWidth={2} />
        <span>{isRunning ? 'Thinking' : 'Reason'}</span>
        {open ? (
          <ChevronDown size={16} strokeWidth={2} />
        ) : (
          <ChevronRight size={16} strokeWidth={2} />
        )}
      </button>

      {open && (
        <div className='space-y-4 pl-2'>
          <div className='border-border border-l pl-5'>
            <MarkdownRenderer
              animation={isRunning}
              className='text-text-secondary prose prose-sm dark:prose-invert max-w-none text-[12px] leading-7'
            >
              {message.reasoning}
            </MarkdownRenderer>
          </div>
        </div>
      )}
    </div>
  )
}

function findToolResult(
  block: ConversationBlock,
  toolCallId: string
): Extract<ThreadMessage, { role: 'tool-result' }> | undefined {
  return [...block.messages]
    .reverse()
    .find(
      (message): message is Extract<ThreadMessage, { role: 'tool-result' }> =>
        message.role === 'tool-result' && message.toolCallId === toolCallId
    )
}

type ToolCallViewProps = {
  block: ConversationBlock
  message: Extract<ThreadMessage, { role: 'tool-call' }>
}

function ToolCallView({ block, message }: ToolCallViewProps) {
  const visibleTools = message.toolCalls.filter(
    (tool) => !tool.function.name.startsWith(ASK_USER_NAMESPACE)
  )

  if (!visibleTools.length) return null

  return (
    <div className='space-y-3'>
      {visibleTools.map((tool) => (
        <ToolCallButton key={tool.id} tool={tool} result={findToolResult(block, tool.id)} />
      ))}
      {/* <div className='text-primary flex items-center gap-2 pt-1 text-[15px] font-medium'>
        <Wrench size={15} />
        <span>{visibleTools.length} tools</span>
      </div> */}
    </div>
  )
}

function BlockView({ block }: { block: ConversationBlock }) {
  return (
    <div className='space-y-6'>
      {block.messages.map((message) => (
        <MessageView key={message.id} block={block} message={message} />
      ))}
    </div>
  )
}

export function MessageList() {
  const { threadId } = useChatContext()
  const blocks = useThreadBlocks(threadId)

  return (
    <div className='mx-auto flex w-full max-w-[920px] flex-col gap-12 px-8 py-12'>
      {blocks?.map((block) => <BlockView key={block.id} block={block} />)}
    </div>
  )
}

type ToolCallButtonProps = {
  tool: ToolCall
  result?: Extract<ThreadMessage, { role: 'tool-result' }>
}

function ToolCallButton({ tool, result }: ToolCallButtonProps) {
  const [open, setOpen] = useState(false)
  const isRunning = !result
  const isSuccess = result?.status === 'success'
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)

  return (
    <div className='space-y-2'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='border-border bg-background/80 dark:bg-background/60 hover:bg-foreground/[0.03] dark:hover:bg-foreground/[0.05] flex w-full items-center gap-3 rounded-[22px] border px-4 py-3 text-left shadow-[0_2px_18px_rgba(0,0,0,0.03)] transition dark:shadow-[0_6px_24px_rgba(0,0,0,0.22)]'
      >
        <div className='text-text-secondary shrink-0'>
          <SquareTerminal size={17} strokeWidth={1.8} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-3'>
            <span className='text-foreground truncate text-[15px] font-medium'>
              {getToolLabel(tool.function.name)}
            </span>
            {isSuccess && (
              <span className='rounded-full bg-emerald-100 px-2 py-0.5 text-[12px] font-medium text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'>
                Success
              </span>
            )}
            {isRunning && (
              <span className='bg-foreground/6 text-text-secondary dark:bg-foreground/10 rounded-full px-2 py-0.5 text-[12px] font-medium'>
                Running
              </span>
            )}
            {isError && (
              <span className='rounded-full bg-red-100 px-2 py-0.5 text-[12px] font-medium text-red-500 dark:bg-red-950/40 dark:text-red-300'>
                Error
              </span>
            )}
          </div>
        </div>
        <div className='text-text-secondary flex items-center gap-3 text-[13px]'>
          {duration && (
            <span className='flex items-center gap-1.5'>
              <Clock3 size={14} />
              {duration}
            </span>
          )}
          {isRunning && <Ellipsis size={16} className='animate-pulse' />}
          {isSuccess && (
            <CheckCircle2 size={16} className='text-emerald-500 dark:text-emerald-300' />
          )}
          {isError && <XCircle size={16} className='text-red-500 dark:text-red-300' />}
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {open && (
        <div className='border-border bg-foreground/[0.03] dark:bg-foreground/[0.04] rounded-[22px] border p-4'>
          <div className='space-y-4'>
            <section className='space-y-2'>
              <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                Arguments
              </div>
              <pre className='bg-background text-text-secondary overflow-x-auto rounded-2xl p-3 text-xs leading-6'>
                {tool.function.arguments}
              </pre>
            </section>

            {(result?.result !== undefined || result?.error !== undefined) && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  {result?.error !== undefined ? 'Error' : 'Result'}
                </div>
                <pre className='bg-background text-text-secondary overflow-x-auto rounded-2xl p-3 text-xs leading-6'>
                  {JSON.stringify(result?.error ?? result?.result, null, 2)}
                </pre>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
