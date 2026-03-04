import { useState, useRef, useEffect, useCallback } from 'react'
// import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
import type {
  AgentLifecycleEventKey,
  PlannerEventKey,
  WorkflowEventKey,
} from '@/agent/core/event/channels'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'analyzing' | 'planning' | 'executing' | 'done'
type PlanStatus = 'pending' | 'running' | 'completed'

interface Plan {
  id: string
  description: string
  status: PlanStatus
}

interface WorkflowState {
  text: string
  events: Array<{ type: string; label: string }>
  streaming: boolean
}

interface SseEvent {
  type: AgentLifecycleEventKey | WorkflowEventKey | PlannerEventKey
  data: Record<string, unknown>
}

// ── SSE demo data ─────────────────────────────────────────────────────────────
const SESSION_ID = 'c65dbc7b-807c-4095-8057-9f53409664ec'
const PLANNER_ID = '91eba7f7-639f-4b8b-ba89-89a91320af50'
const WORKFLOW_ID = '8379564f-2e93-47ed-959f-2c8b37625a5b'

const USER_INPUT =
  '帮我做一个极简的命令行待办清单程序设计。\n\n要求：\n1. 先分析需要哪些功能\n2. 再给出一个分步骤实现计划\n3. 每个步骤只用一句话描述\n4. 不要直接写代码'

const PLANS: Omit<Plan, 'status'>[] = [
  { id: 'p1', description: '分析待办清单的核心功能需求，包括添加、删除、查看和标记完成。' },
  { id: 'p2', description: '设计程序的数据结构，用于存储待办事项。' },
  { id: 'p3', description: '设计命令行交互逻辑，解析用户输入的命令和参数。' },
  { id: 'p4', description: '实现添加新待办事项的功能。' },
  { id: 'p5', description: '实现列出所有待办事项的功能。' },
  { id: 'p6', description: '实现将指定待办事项标记为已完成的功能。' },
  { id: 'p7', description: '实现删除指定待办事项的功能。' },
  { id: 'p8', description: '设计数据持久化方案，将待办事项保存到本地文件。' },
  { id: 'p9', description: '编写主程序循环，持续接收并处理用户命令。' },
  { id: 'p10', description: '测试所有核心功能，确保其正常工作。' },
]

const PLAN_RESPONSES: Record<string, string> = {
  p1: `## 核心功能需求分析

待办清单程序需要以下**核心功能**：

### 1. 添加任务
\`\`\`
todo add "完成项目报告"
\`\`\`
用户可以通过命令行添加新的待办事项，支持标题和可选截止日期。

### 2. 查看列表
\`\`\`
todo list
\`\`\`
显示所有待办事项，包括编号、状态、标题。

### 3. 标记完成
\`\`\`
todo done 1
\`\`\`
将指定编号的任务标记为已完成（✓）。

### 4. 删除任务
\`\`\`
todo remove 1
\`\`\`
从列表中永久删除指定任务。

> **总结**：以上四个功能构成最小可用产品（MVP），满足日常任务管理需求。`,

  p2: `## 数据结构设计

采用 **JSON 文件** 作为持久化存储，内存中使用数组管理任务列表。

### 任务对象结构

\`\`\`json
{
  "id": 1,
  "title": "完成项目报告",
  "completed": false,
  "createdAt": "2026-03-04T10:00:00Z",
  "dueDate": null
}
\`\`\`

### 存储文件

\`\`\`
~/.todos.json
\`\`\`

内存结构为 \`Array<TodoItem>\`，读写时序列化/反序列化 JSON。`,

  p3: `## 命令行交互设计

使用 **argv 解析** 处理用户输入：

\`\`\`
node todo.js <command> [args...]
\`\`\`

### 命令路由表

| 命令 | 参数 | 说明 |
|------|------|------|
| \`add\` | \`<title>\` | 添加任务 |
| \`list\` | - | 列出所有任务 |
| \`done\` | \`<id>\` | 标记完成 |
| \`remove\` | \`<id>\` | 删除任务 |

解析逻辑：读取 \`process.argv.slice(2)\`，第一个参数为命令，其余为参数。`,

  p4: `## 添加任务功能实现

核心逻辑：

1. 从命令行参数读取任务标题
2. 生成唯一 ID（当前最大 ID + 1）
3. 构造任务对象并追加到数组
4. 写入 JSON 文件持久化

**关键点**：标题为空时应提示错误；支持带空格的标题（用引号包裹）。`,

  p5: `## 列出任务功能实现

格式化输出所有任务：

\`\`\`
[1] ✓ 设计数据结构
[2] ○ 实现命令行交互
[3] ○ 添加持久化存储
\`\`\`

- ✓ 表示已完成，显示为灰色
- ○ 表示待完成，显示为正常色
- 列表为空时提示"暂无待办事项"`,

  p6: `## 标记完成功能实现

流程：

1. 解析目标任务 ID
2. 在数组中查找对应任务
3. 将 \`completed\` 字段设为 \`true\`
4. 持久化到文件

**错误处理**：ID 不存在时输出提示；已完成的任务再次标记时友好提示。`,

  p7: `## 删除任务功能实现

流程：

1. 解析目标任务 ID
2. 用 \`filter\` 过滤掉对应任务
3. 更新内存数组
4. 写回 JSON 文件

**注意**：删除后 ID 不重新排序，避免混乱。`,

  p8: `## 数据持久化方案

使用 Node.js 内置 \`fs\` 模块：

\`\`\`javascript
// 读取
const load = () => {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
};

// 写入
const save = (todos) => {
  fs.writeFileSync(FILE, JSON.stringify(todos, null, 2));
};
\`\`\`

文件路径：\`~/.todos.json\`，首次运行自动创建。`,

  p9: `## 主程序循环设计

入口文件结构：

\`\`\`javascript
const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'add':    addTodo(args.join(' ')); break;
  case 'list':   listTodos(); break;
  case 'done':   markDone(Number(args[0])); break;
  case 'remove': removeTodo(Number(args[0])); break;
  default:       showHelp();
}
\`\`\`

每次执行完命令后程序退出，下次运行时重新加载数据。`,

  p10: `## 测试计划

### 功能测试用例

| 测试 | 命令 | 期望结果 |
|------|------|----------|
| 添加任务 | \`todo add "写报告"\` | 成功添加，显示 ID |
| 列出任务 | \`todo list\` | 显示所有任务 |
| 标记完成 | \`todo done 1\` | 任务标记 ✓ |
| 删除任务 | \`todo remove 1\` | 任务从列表移除 |
| 边界：空标题 | \`todo add ""\` | 错误提示 |
| 边界：无效ID | \`todo done 999\` | 错误提示 |

**测试结果**：所有核心功能通过验证，程序可正常使用。✅`,
}

// ── Simulation engine ─────────────────────────────────────────────────────────
function* buildEventStream(): Generator<SseEvent> {
  yield {
    type: 'agent-session-start-analyze-input',
    data: { sessionId: SESSION_ID, userInput: USER_INPUT },
  }
  yield { type: 'agent-session-end-analyze-input', data: { sessionId: SESSION_ID, mode: 'plan' } }
  yield { type: 'planner-start-generate', data: { sessionId: SESSION_ID, plannerId: PLANNER_ID } }
  yield {
    type: 'planner-end-generate',
    data: {
      sessionId: SESSION_ID,
      plannerId: PLANNER_ID,
      plans: PLANS.map((p) => ({ ...p, status: 'pending' as PlanStatus })),
    },
  }

  for (const plan of PLANS) {
    yield {
      type: 'planner-execute-item-start',
      data: { plannerId: PLANNER_ID, plan: { ...plan, status: 'running' as PlanStatus } },
    }
    yield {
      type: 'workflow-start',
      data: {
        input: plan.description,
        ctx: { sessionId: SESSION_ID, workflowId: WORKFLOW_ID, planId: plan.id },
      },
    }
    yield {
      type: 'workflow-llm-start',
      data: { ctx: { workflowId: WORKFLOW_ID, planId: plan.id } },
    }
    yield {
      type: 'workflow-llm-text-start',
      data: { ctx: { workflowId: WORKFLOW_ID, planId: plan.id } },
    }

    const text = PLAN_RESPONSES[plan.id] ?? '正在处理中...'
    let accumulated = ''
    let i = 0
    while (i < text.length) {
      const chunkSize = Math.floor(Math.random() * 6) + 2
      const delta = text.slice(i, i + chunkSize)
      accumulated += delta
      yield {
        type: 'workflow-llm-text-delta',
        data: {
          ctx: { workflowId: WORKFLOW_ID, planId: plan.id },
          chunk: { content: accumulated, delta },
        },
      }
      i += chunkSize
    }

    yield {
      type: 'workflow-llm-text-end',
      data: { ctx: { workflowId: WORKFLOW_ID, planId: plan.id } },
    }
    yield {
      type: 'workflow-llm-end',
      data: { ctx: { workflowId: WORKFLOW_ID, planId: plan.id } },
    }
    yield {
      type: 'workflow-finished',
      data: { ctx: { workflowId: WORKFLOW_ID, planId: plan.id } },
    }
    yield {
      type: 'planner-execute-item-success',
      data: { plannerId: PLANNER_ID, plan: { ...plan, status: 'completed' as PlanStatus } },
    }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ phase, label }: { phase: Phase; label: string }) {
  const base = 'font-mono text-[11px] px-2.5 py-0.5 rounded-full border transition-colors'
  const variants: Record<Phase, string> = {
    idle: 'border-border text-text-secondary',
    analyzing: 'border-primary text-primary bg-primary/10 animate-pulse',
    planning: 'border-primary text-primary bg-primary/10 animate-pulse',
    executing: 'border-primary text-primary bg-primary/10 animate-pulse',
    done: 'border-green-500 text-green-500 bg-green-500/10',
  }
  return <span className={`${base} ${variants[phase]}`}>{label}</span>
}

function PlanStatusIcon({ status }: { status: PlanStatus }) {
  if (status === 'completed') {
    return (
      <span className='flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-green-500 bg-green-500/10 text-[9px] text-green-500'>
        ✓
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className='border-primary bg-primary/10 flex h-[18px] w-[18px] shrink-0 animate-spin items-center justify-center rounded-full border'>
        <span className='bg-primary h-1 w-1 rounded-full' />
      </span>
    )
  }
  // pending
  return (
    <span className='border-border flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border' />
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function Welcome() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [plans, setPlans] = useState<Plan[]>([])
  const [planWorkflows, setPlanWorkflows] = useState<Record<string, WorkflowState>>({})
  const [expandedPlanIds, setExpandedPlanIds] = useState<string[]>([])
  const [completedCount, setCompletedCount] = useState(0)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRunningRef = useRef(false)

  const scheduleNext = useCallback((gen: Generator<SseEvent>, delay = 8) => {
    timerRef.current = setTimeout(() => {
      if (!isRunningRef.current) return
      const result = gen.next()
      if (result.done) {
        setPhase('done')
        isRunningRef.current = false
        return
      }
      processEvent(result.value, gen)
    }, delay)
  }, [])

  const processEvent = useCallback(
    (event: SseEvent, gen: Generator<SseEvent>) => {
      const { type, data } = event

      switch (type) {
        case 'agent-session-start-analyze-input':
          setPhase('analyzing')
          scheduleNext(gen, 600)
          break

        case 'agent-session-end-analyze-input':
          setPhase('planning')
          scheduleNext(gen, 400)
          break

        case 'planner-start-generate':
          scheduleNext(gen, 300)
          break

        case 'planner-end-generate':
          setPlans((data.plans as Plan[]).map((p) => ({ ...p, status: 'pending' })))
          setPhase('executing')
          scheduleNext(gen, 500)
          break

        case 'planner-execute-item-start': {
          const pid = (data.plan as Plan).id
          setPlans((prev) => prev.map((p) => (p.id === pid ? { ...p, status: 'running' } : p)))
          setExpandedPlanIds((pre) => Array.from(new Set([...pre, pid])))
          setPlanWorkflows((prev) => ({
            ...prev,
            [pid]: {
              text: '',
              events: [{ type: 'llm-start', label: 'LLM started' }],
              streaming: true,
            },
          }))
          scheduleNext(gen, 200)
          break
        }

        case 'workflow-llm-text-delta': {
          const pid = (data.ctx as { planId: string }).planId
          const { content } = data.chunk as { content: string; delta: string }
          setPlanWorkflows((prev) => ({
            ...prev,
            [pid]: {
              ...(prev[pid] ?? { text: '', events: [], streaming: true }),
              text: content,
              streaming: true,
            },
          }))
          scheduleNext(gen, 12)
          break
        }

        case 'workflow-llm-text-end': {
          const pid = (data.ctx as { planId: string }).planId
          setPlanWorkflows((prev) => ({
            ...prev,
            [pid]: {
              ...(prev[pid] ?? { text: '', events: [], streaming: false }),
              streaming: false,
            },
          }))
          scheduleNext(gen, 200)
          break
        }

        case 'workflow-tool-call-start':
        case 'workflow-tool-call-success':
          scheduleNext(gen, 100)
          break

        case 'planner-execute-item-success': {
          const pid = (data.plan as Plan).id
          setPlans((prev) => prev.map((p) => (p.id === pid ? { ...p, status: 'completed' } : p)))
          setCompletedCount((prev) => prev + 1)
          scheduleNext(gen, 400)
          break
        }

        default:
          scheduleNext(gen, 30)
      }
    },
    [scheduleNext]
  )

  const handlePlay = () => {
    isRunningRef.current = true
    setPhase('analyzing')
    setPlans([])
    setPlanWorkflows({})
    setExpandedPlanIds([])
    setCompletedCount(0)
    const gen = buildEventStream()
    scheduleNext(gen, 300)
  }

  const handleReset = () => {
    isRunningRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('idle')
    setPlans([])
    setPlanWorkflows({})
    setExpandedPlanIds([])
    setCompletedCount(0)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      isRunningRef.current = false
    },
    []
  )

  const toggleExpand = (planId: string) => {
    setExpandedPlanIds((pre) => Array.from(new Set([...pre, planId])))
  }

  const progress = plans.length > 0 ? (completedCount / plans.length) * 100 : 0

  const phaseLabel: Record<Phase, string> = {
    idle: 'READY',
    analyzing: 'ANALYZING INPUT',
    planning: 'GENERATING PLAN',
    executing: `EXECUTING — ${completedCount}/${plans.length}`,
    done: 'COMPLETE',
  }

  return (
    <div className='bg-background text-foreground min-h-screen'>
      <div className='mx-auto flex max-w-3xl flex-col px-5 py-6'>
        {/* Header */}
        <div className='border-border mb-5 flex items-center justify-between border-b pb-5'>
          <div className='flex items-center gap-2.5'>
            <span className='bg-primary shadow-primary h-2 w-2 rounded-full shadow-[0_0_8px]' />
            <span className='text-text-secondary font-mono text-[13px] tracking-widest'>
              AGENT RUNNER
            </span>
          </div>
          <StatusBadge phase={phase} label={phaseLabel[phase]} />
        </div>

        {/* Controls */}
        <div className='mb-5 flex items-center gap-2'>
          <button
            onClick={handlePlay}
            disabled={phase !== 'idle' && phase !== 'done'}
            className='bg-primary flex items-center gap-2 rounded-md px-5 py-2 font-mono text-xs font-medium tracking-wide text-white transition-all hover:opacity-90 active:scale-95 disabled:cursor-default disabled:opacity-30'
          >
            <svg width='10' height='12' viewBox='0 0 10 12' fill='currentColor'>
              <polygon points='0,0 10,6 0,12' />
            </svg>
            Run Demo
          </button>

          {phase !== 'idle' && (
            <button
              onClick={handleReset}
              className='border-border text-text-secondary hover:border-foreground/30 hover:text-foreground flex items-center gap-2 rounded-md border px-4 py-2 font-mono text-xs transition-colors'
            >
              <svg
                width='11'
                height='11'
                viewBox='0 0 11 11'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.5'
              >
                <path d='M1 5.5A4.5 4.5 0 1 0 5.5 1' strokeLinecap='round' />
                <polyline points='1,1 1,5.5 5.5,5.5' />
              </svg>
              Reset
            </button>
          )}
        </div>

        {/* User input */}
        {phase !== 'idle' && (
          <div className='border-border bg-foreground/[0.03] mb-4 flex items-start gap-3 rounded-xl border px-4 py-3.5'>
            <div className='from-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br to-purple-500 font-mono text-xs font-semibold text-white'>
              U
            </div>
            <p className='text-[13px] leading-relaxed whitespace-pre-wrap'>{USER_INPUT}</p>
          </div>
        )}

        {/* Progress bar */}
        {plans.length > 0 && (
          <div className='bg-border mb-4 h-px w-full overflow-hidden rounded-full'>
            <div
              className='from-primary h-full rounded-full bg-gradient-to-r to-purple-500 transition-[width] duration-500'
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Plans */}
        {plans.length > 0 && (
          <>
            {/* Section divider label */}
            <div className='mb-3 flex items-center gap-2'>
              <div className='bg-border h-px flex-1' />
              <span className='text-foreground/25 font-mono text-[10px] tracking-[0.12em] uppercase'>
                execution plan — {plans.length} steps
              </span>
              <div className='bg-border h-px flex-1' />
            </div>

            <div className='flex flex-col gap-1.5'>
              {plans.map((plan, idx) => {
                const wf = planWorkflows[plan.id]
                const isExpanded = expandedPlanIds.includes(plan.id)

                return (
                  <div
                    key={plan.id}
                    className={[
                      'overflow-hidden rounded-lg border transition-colors duration-200',
                      plan.status === 'running'
                        ? 'border-primary'
                        : isExpanded
                          ? 'border-border/70'
                          : 'border-border',
                    ].join(' ')}
                  >
                    {/* Plan header row */}
                    <div
                      onClick={() => wf && toggleExpand(plan.id)}
                      className={[
                        'bg-foreground/[0.02] flex items-center gap-2.5 px-3.5 py-2.5 transition-colors',
                        wf ? 'hover:bg-foreground/[0.04] cursor-pointer select-none' : '',
                      ].join(' ')}
                    >
                      <PlanStatusIcon status={plan.status} />

                      <span className='text-foreground/25 min-w-[20px] font-mono text-[10px]'>
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <span
                        className={[
                          'flex-1 text-[13px] leading-snug transition-colors',
                          plan.status === 'completed' ? 'text-text-secondary' : 'text-foreground',
                        ].join(' ')}
                      >
                        {plan.description}
                      </span>

                      {wf && (
                        <svg
                          width='12'
                          height='12'
                          viewBox='0 0 12 12'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='1.5'
                          className={[
                            'text-foreground/25 shrink-0 transition-transform duration-200',
                            isExpanded ? 'rotate-90' : '',
                          ].join(' ')}
                        >
                          <polyline points='4,2 8,6 4,10' />
                        </svg>
                      )}
                    </div>

                    {/* Workflow body */}
                    {wf && (
                      <div
                        className={[
                          'border-border bg-foreground/[0.015] border-t transition-[max-height] duration-300',
                          isExpanded ? 'max-h-[600px] overflow-y-auto' : 'max-h-0 overflow-hidden',
                        ].join(' ')}
                      >
                        <div className='flex flex-col gap-2 p-3.5'>
                          {/* LLM text event */}
                          <div className='flex items-start gap-2 font-mono text-[11px]'>
                            <span className='bg-primary mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full' />
                            <div className='min-w-0 flex-1'>
                              <span className='text-foreground/30 mb-1.5 block'>
                                workflow-llm-text
                              </span>
                              <div className='border-border bg-background rounded-md border px-3.5 py-3'>
                                <pre className='text-foreground font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap'>
                                  {wf.text}
                                  {wf.streaming && (
                                    <span className='bg-primary ml-0.5 inline-block h-[13px] w-1.5 animate-[blink_0.8s_step-end_infinite] align-text-bottom' />
                                  )}
                                </pre>
                                {/* <MarkdownRenderer
                                  className='text-foreground font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap'
                                  animation={wf.streaming}
                                >
                                  {wf.text}
                                </MarkdownRenderer> */}
                              </div>
                            </div>
                          </div>

                          {/* Finished event */}
                          {plan.status === 'completed' && (
                            <div className='flex items-center gap-2 font-mono text-[11px]'>
                              <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-green-500' />
                              <span className='text-foreground/30'>workflow-finished</span>
                              <span className='ml-2 text-green-500'>✓ plan step completed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Idle placeholder */}
        {phase === 'idle' && (
          <div className='text-foreground/20 py-16 text-center font-mono text-xs'>
            Press Run Demo to simulate SSE streaming
          </div>
        )}
      </div>
    </div>
  )
}
