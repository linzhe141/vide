import { memo, type ReactNode, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight, Sparkles, Wrench } from 'lucide-react'
import type {
  ReasoningBlockItem,
  ReasoningBlockSessionMessage,
  Workflow,
} from '@/store/sessionStore/types'
import { AssistantReasonMessage } from './AssistantReasonMessage'
import { ToolCallMessage } from './ToolCallMessage'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'

type ReasoningBlockMessageProps = {
  workflowId: string
  workflowStatus: Workflow['runtime']['status']
  message: ReasoningBlockSessionMessage
}

export const ReasoningBlockMessage = memo(function ReasoningBlockMessage({
  workflowId,
  workflowStatus,
  message,
}: ReasoningBlockMessageProps) {
  const stepItems = useMemo(
    () => message.items.filter((item) => item.role !== 'workflow'),
    [message.items]
  )
  const { toolCount, isStreaming } = useMemo(() => {
    return stepItems.reduce(
      (state, item) => {
        if (item.role === 'assistant-reason' && item.reasoning) {
          state.isStreaming = true
        }

        if (item.role === 'tool-call') {
          state.toolCount += item.toolCalls.length
          if (item.toolCalls.some((toolCall) => !toolCall.result)) {
            state.isStreaming = true
          }
        }

        return state
      },
      { toolCount: 0, isStreaming: false }
    )
  }, [stepItems])
  const statusLabel = isStreaming || workflowStatus === 'running' ? '进行中' : '已完成'
  const contentId = `${message.id}-content`

  const [open, setOpen] = useState(true)

  return (
    <section className='border-border bg-background space-y-3 rounded-2xl border px-3.5 py-3'>
      <button
        type='button'
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        className='text-text-secondary hover:text-foreground focus-visible:ring-primary/25 flex w-full items-center justify-between gap-3 rounded-xl text-left text-sm font-medium transition-colors'
      >
        <div className='flex min-w-0 items-center gap-3'>
          <span className='text-foreground text-[11px] font-semibold tracking-[0.18em] uppercase'>
            推理过程
          </span>
          <span className='bg-foreground/4 text-text-info rounded-full px-2.5 py-1 text-[11px]'>
            {stepItems.length} steps
          </span>
          {toolCount > 0 && (
            <span className='bg-foreground/4 text-text-info rounded-full px-2.5 py-1 text-[11px]'>
              {toolCount} tools
            </span>
          )}
          <span className='text-text-info text-[11px]'>{statusLabel}</span>
        </div>
        {open ? (
          <ChevronDown size={18} strokeWidth={2} aria-hidden='true' />
        ) : (
          <ChevronRight size={18} strokeWidth={2} aria-hidden='true' />
        )}
      </button>

      {open && stepItems.length > 0 && (
        <div id={contentId} className='space-y-0'>
          {stepItems.map((item, index) => {
            const stepMeta = getStepMeta(item)

            switch (item.role) {
              case 'assistant-reason':
                return (
                  <ReasoningStep
                    key={item.id}
                    title={stepMeta.title}
                    icon={stepMeta.icon}
                    isLast={index === stepItems.length - 1}
                  >
                    <AssistantReasonMessage message={item} />
                  </ReasoningStep>
                )

              case 'tool-call':
                return (
                  <ReasoningStep
                    key={item.id}
                    title={stepMeta.title}
                    icon={stepMeta.icon}
                    isLast={index === stepItems.length - 1}
                  >
                    <ToolCallMessage
                      workflowId={workflowId}
                      workflowStatus={workflowStatus}
                      message={item}
                    />
                  </ReasoningStep>
                )

              case 'error':
                return (
                  <ReasoningStep
                    key={item.id}
                    title={stepMeta.title}
                    icon={stepMeta.icon}
                    isLast={index === stepItems.length - 1}
                  >
                    <div className='rounded-2xl border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-600 dark:text-red-400'>
                      <MarkdownRenderer animation={false}>
                        {JSON.stringify(item.error, null, 2)}
                      </MarkdownRenderer>
                    </div>
                  </ReasoningStep>
                )
            }
          })}
        </div>
      )}
    </section>
  )
})

function ReasoningStep({
  title,
  icon,
  isLast,
  children,
}: {
  title: string
  icon: ReactNode
  isLast: boolean
  children: ReactNode
}) {
  return (
    <div className='relative pl-10'>
      {!isLast && <div className='bg-border absolute top-8 bottom-0 left-3.5 w-px' />}
      <div className='border-border bg-background text-text-secondary absolute top-0.5 left-0 flex h-7 w-7 items-center justify-center rounded-lg border'>
        {icon}
      </div>
      <div className='space-y-2 pb-4'>
        <div className='text-text-info text-[11px] font-semibold tracking-[0.14em] uppercase'>
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}

function getStepMeta(item: ReasoningBlockItem) {
  switch (item.role) {
    case 'assistant-reason':
      return {
        title: item.reasoning ? '思考中' : '推理',
        icon: <Sparkles size={14} strokeWidth={2} />,
      }

    case 'tool-call':
      return {
        title: getToolStepTitle(item),
        icon: <Wrench size={14} strokeWidth={2} />,
      }

    case 'error':
      return {
        title: '错误',
        icon: <AlertCircle size={14} strokeWidth={2} />,
      }

    case 'workflow':
      return {
        title: '子工作流',
        icon: <Wrench size={14} strokeWidth={2} />,
      }
  }
}

function getToolStepTitle(item: Extract<ReasoningBlockItem, { role: 'tool-call' }>) {
  const names = item.toolCalls.map((toolCall) => toolCall.toolCall.function.name)
  if (names.length === 1) {
    return `使用工具 ${names[0]}`
  }

  return `使用 ${names.length} 个工具`
}
