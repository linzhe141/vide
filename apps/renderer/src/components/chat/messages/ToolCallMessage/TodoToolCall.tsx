import type { ToolCall } from '@vide/ai'
import type { ToolCallState } from '@/store/sessionStore/types'
import { CheckCircle2, ChevronDown, ChevronRight, Circle, ListTodo, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type TodoStatus = 'pending' | 'in_progress' | 'completed'

type TodoItem = {
  content: string
  status: TodoStatus
}

type TodoCounts = {
  pending?: number
  inProgress?: number
  completed?: number
}

type TodoResult = {
  todos?: TodoItem[]
  counts?: TodoCounts
}

type TodoToolCallProps = {
  tool: ToolCall
  result?: ToolCallState['result']
}

function TodoToolCall({ result }: TodoToolCallProps) {
  const [open, setOpen] = useState(false)
  const isRunning = !result
  const isError = result?.status === 'error'

  const todoResult = result?.result?.result as TodoResult | undefined
  const todos = todoResult?.todos ?? []
  const counts = todoResult?.counts ?? {}

  const completed = counts.completed ?? 0
  const total = todos.length
  // 回显的时候，不需要显示进度条，只有在运行中才显示
  if (total === 0) return null
  if (isError) {
    return (
      <div className='border-border bg-background flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left'>
        <div className='bg-danger/10 text-danger border-danger/10 shrink-0 rounded-lg border p-1.5'>
          <ListTodo size={15} strokeWidth={1.9} />
        </div>
        <span className='text-text-secondary truncate text-sm'>Failed to update to-do list</span>
      </div>
    )
  }

  return (
    <div className='space-y-1.5'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='border-border bg-background hover:bg-foreground/3 dark:hover:bg-foreground/5 flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-200'
      >
        <div className='bg-primary/8 text-primary border-primary/10 shrink-0 rounded-lg border p-1.5'>
          <ListTodo size={15} strokeWidth={1.9} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <span className='text-foreground truncate text-sm font-medium'>Update to-do list</span>
            {isRunning ? (
              <span className='text-text-secondary flex shrink-0 items-center gap-1.5 text-[12px] font-medium'>
                <Loader2 size={12} className='animate-spin' />
                Updating
              </span>
            ) : (
              <span className='text-text-secondary shrink-0 text-[12px] font-medium'>
                {completed}/{total} completed
              </span>
            )}
          </div>
        </div>
        <div className='text-text-secondary flex shrink-0 items-center gap-2 text-xs'>
          {!isRunning && <CheckCircle2 size={15} className='text-success' />}
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </button>

      {open && (
        <div className='border-border bg-foreground/3 dark:bg-foreground/4 max-h-56 overflow-y-auto rounded-lg border p-2'>
          <ul className='space-y-1'>
            {todos.map((todo, index) => {
              const done = todo.status === 'completed'
              const active = todo.status === 'in_progress'
              return (
                <li
                  key={`${todo.content}-${index}`}
                  className='flex items-start gap-2 rounded-md px-2 py-1.5'
                >
                  <span
                    className={cn(
                      'mt-0.5 shrink-0',
                      done ? 'text-success' : active ? 'text-primary' : 'text-text-info'
                    )}
                  >
                    {done ? (
                      <CheckCircle2 size={14} />
                    ) : active ? (
                      <Loader2 size={14} className='animate-spin' />
                    ) : (
                      <Circle size={14} />
                    )}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 text-[13px] leading-snug',
                      done
                        ? 'text-text-info line-through'
                        : active
                          ? 'text-foreground font-medium'
                          : 'text-text-secondary'
                    )}
                  >
                    {todo.content}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default TodoToolCall
