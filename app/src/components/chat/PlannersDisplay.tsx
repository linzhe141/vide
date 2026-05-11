import { cn } from '@/app/src/lib/utils'
import { useThreadPlanners, type PlanStep } from '../../store/threadStore'
import { useChatContext } from './ChatProvider';

export function PlannersDisplay({ className }: { className?: string }) {
  const { threadId } = useChatContext()

  const planners = useThreadPlanners(threadId)
  if (!planners?.length)
    return (
      <div className={cn('text-text-info flex justify-center p-4', className)}>
        当前 thread 没有 planner
      </div>
    )

  return (
    <div className={cn('space-y-4 p-4', className)}>
      {planners.map((planner) => (
        <div key={planner.id} className='bg-background rounded-lg border p-4 shadow-sm'>
          <Planner planner={planner}></Planner>
        </div>
      ))}
    </div>
  )
}

function StatusDot({ status }: { status: PlanStep['status'] }) {
  return (
    <div
      className={cn('mt-1 min-h-2 min-w-2 rounded-full', {
        'bg-primary': status === 'completed',
        'bg-foreground animate-pulse': status === 'running',
        'bg-border': status === 'pending',
        'bg-destructive': status === 'failed',
      })}
    />
  )
}

export function Planner({ planner }: { planner: { id: string; plan: PlanStep[] } }) {
  return (
    <div className='h-full max-h-64 w-full space-y-3 overflow-auto overflow-x-hidden pl-4'>
      {planner.plan.map((plan) => (
        <div key={plan.id} className='flex items-center gap-3'>
          <StatusDot status={plan.status} />
          <div className='text-text-secondary text-sm'>{plan.description}</div>
        </div>
      ))}
    </div>
  )
}
