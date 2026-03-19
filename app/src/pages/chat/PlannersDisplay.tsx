import { cn } from '@/app/src/lib/utils'
import { useThreadStore, type PlanStep } from '../../store/threadStore'

export function PlannersDisplay() {
  const planners = useThreadStore((s) => s.planner)

  if (!planners?.length)
    return <div className='text-text-info flex justify-center p-4'>当前 thread 没有 planner</div>

  return (
    <div className='space-y-4 p-4'>
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
    <div className='space-y-3 pl-4'>
      {planner.plan.map((plan) => (
        <div key={plan.id} className='flex items-center gap-3'>
          <StatusDot status={plan.status} />
          <div className='text-text-secondary text-sm'>{plan.description}</div>
        </div>
      ))}
    </div>
  )
}
