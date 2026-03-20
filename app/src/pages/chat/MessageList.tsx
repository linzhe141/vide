import { useThreadStore, type ConversationBlock, type ThreadMessage } from '../../store/threadStore'
import { useState } from 'react'
import type { ToolCall } from '@/agent/core/types'
import { ASK_USER_NAMESPACE } from '@/agent/core/tools/askUserQuestion'
import { AskUserQuestionView } from './AskUserQuestionView'
import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
/* ---------------- message ---------------- */

function MessageView({ message }: { message: ThreadMessage }) {
  switch (message.role) {
    case 'user':
      return (
        <div className='border-primary/50 my-10 rounded-lg border p-3'>
          {/* <pre className='text-sm whitespace-pre-wrap'>{message.content}</pre> */}
          <MarkdownRenderer animation>{message.content}</MarkdownRenderer>
        </div>
      )

    case 'assistant-text':
      return (
        <div className='prose prose-sm dark:prose-invert max-w-none'>
          {/* <pre className='text-sm whitespace-pre-wrap'>{message.content}</pre> */}
          <MarkdownRenderer animation>{message.content}</MarkdownRenderer>
        </div>
      )

    case 'assistant-reason':
      return (
        <div className='border-border text-text-secondary border-l-2 pl-4 text-sm'>
          {/* <pre className='whitespace-pre-wrap'>{message.content}</pre> */}
          <MarkdownRenderer animation>{message.content}</MarkdownRenderer>
        </div>
      )

    case 'error':
      return (
        <div className='rounded-xl border border-red-300 p-4 text-red-500'>
          {/* <pre className='text-xs'>{JSON.stringify(message.error, null, 2)}</pre> */}
          <MarkdownRenderer animation>{JSON.stringify(message.error, null, 2)}</MarkdownRenderer>
        </div>
      )
  }
}

/* ---------------- planner ---------------- */

type ToolCallViewProps = {
  message: Extract<ThreadMessage, { role: 'tool-call' }>
  results: Map<string, unknown>
}

export function ToolCallView({ message, results }: ToolCallViewProps) {
  return (
    <div>
      {message.toolCalls.map((tool) => {
        return (
          <div key={tool.id}>
            <ToolCallButton tool={tool} result={results.get(tool.id)} />
            {/* {!tool.function.name.startsWith('BUILDIN') && (
              <ToolCallButton tool={tool} result={results.get(tool.id)} />
            )} */}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- block ---------------- */

function BlockView({ block }: { block: ConversationBlock }) {
  const [lastAskUserMessageIndex, setLastAskUserMessageIndex] = useState(-1)
  const toolResults = new Map<string, unknown>()

  for (const message of block.messages) {
    if (message.role === 'tool-result') {
      toolResults.set(message.toolCallId, message.result)
    }
  }

  return (
    <div className='relative space-y-3'>
      {block.messages.map((message, index) => {
        if (message.role === 'tool-call') {
          if (message.toolCalls[0].function.name.startsWith(ASK_USER_NAMESPACE)) {
            setLastAskUserMessageIndex(index)
          }
          return (
            <div key={message.id}>
              <ToolCallView message={message} results={toolResults} />
              {index === lastAskUserMessageIndex && <AskUserQuestionView block={block} />}
            </div>
          )
        }

        return <MessageView key={message.id} message={message} />
      })}
    </div>
  )
}

/* ---------------- list ---------------- */

export function MessageList() {
  const blocks = useThreadStore((s) => s.blocks)

  return (
    <div className='mx-auto w-full max-w-3xl space-y-10 px-6 py-10'>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </div>
  )
}

type ToolCallButtonProps = {
  tool: ToolCall
  result?: unknown
}

export function ToolCallButton({ tool, result }: ToolCallButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className='my-1'>
      <button
        onClick={() => setOpen((v) => !v)}
        className='border-border text-text-secondary hover:bg-background flex items-center gap-2 rounded-md border px-3 py-1 text-xs'
      >
        <span className='font-mono'>{tool.function.name}</span>
        <span className='text-text-info'>#{tool.id.slice(0, 4)}</span>
      </button>

      {open && (
        <div className='border-border bg-background mt-2 max-w-[720px] rounded-md border p-3'>
          <div className='space-y-4'>
            <div>
              <div className='text-text-secondary mb-1 text-xs'>Arguments</div>

              <pre className='bg-background overflow-auto rounded p-2 text-xs'>
                {JSON.stringify(tool.function.arguments, null, 2)}
              </pre>
            </div>

            {result !== undefined && (
              <div>
                <div className='text-text-secondary mb-1 text-xs'>Result</div>

                <pre className='bg-background overflow-auto rounded p-2 text-xs'>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
