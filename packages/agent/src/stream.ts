import type { WorkflowEvent } from './event'

type WorkflowEventContext = WorkflowEvent & {
  ctx: {
    sessionId: string | null
    workflowId: string | null
    namespace: string | null
    mainWorkflowId: string | null
  }
}
export class WorkflowStream {
  recordedEvents: WorkflowEventContext[] = []
  stream: ReadableStream<WorkflowEventContext>
  sessionId: string | null = null
  workflowId: string | null = null
  namespace: string | null = null
  mainWorkflowId: string | null = null
  signal: AbortSignal
  private abortController = new AbortController()
  private controller!: ReadableStreamDefaultController<WorkflowEventContext>
  constructor() {
    this.signal = this.abortController.signal
    this.stream = new ReadableStream<WorkflowEventContext>({
      start: (controller) => {
        this.controller = controller
      },
    })
  }

  // 触发中断：signal 会被传播到 LLM call，从而中断进行中的请求。
  // 不在此处 close controller —— 由 workflow 在 push 终态事件后调用 end() 关闭，避免重复关闭。
  abort() {
    this.abortController.abort()
  }

  push(data: WorkflowEvent) {
    const record: WorkflowEventContext = {
      ...data,
      ctx: {
        sessionId: this.sessionId,
        workflowId: this.workflowId,
        namespace: this.namespace,
        mainWorkflowId: this.mainWorkflowId,
      },
    }
    this.recordedEvents.push(record)
    this.controller.enqueue(record)
  }

  end() {
    this.controller.close()
  }

  async *[Symbol.asyncIterator]() {
    const reader = this.stream.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }
        yield value
      }
    } finally {
      reader.releaseLock()
    }
  }
}
