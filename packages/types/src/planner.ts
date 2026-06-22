export type PlanStep = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  description: string
}