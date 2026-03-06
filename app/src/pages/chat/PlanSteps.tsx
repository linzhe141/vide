import type { PlanStep } from '@/agent/core/agentSession'
import clsx from 'clsx'

export function PlanSteps({ plans }: { plans: PlanStep[] }) {
  return (
    <div className='border-border bg-surface max-h-40 space-y-2 overflow-y-auto rounded-xl border p-3 px-2'>
      {plans.map((step, index) => (
        <div
          key={step.id}
          className={clsx(
            'flex gap-3 rounded-lg border p-3 text-sm transition-colors',
            step.status === 'running' && 'border-primary bg-primary/5',
            step.status === 'completed' && 'border-border bg-surface-muted',
            step.status === 'failed' && 'border-red-400 bg-red-50',
            step.status === 'pending' && 'border-border'
          )}
        >
          {/* step index */}
          <div className='bg-surface-muted text-text-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium'>
            {index + 1}
          </div>

          {/* description */}
          <div className='text-text-secondary flex-1'>{step.description}</div>
        </div>
      ))}
    </div>
  )
}
