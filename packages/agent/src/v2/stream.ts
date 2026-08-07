import type { WorkflowEvent } from './event'

type WorkflowEventContext = WorkflowEvent & {
  ctx: { sessionId: string | null; workflowId: string | null }
}
export class WorkflowStream {
  recordedEvents: WorkflowEventContext[] = []
  stream: ReadableStream<WorkflowEventContext>
  sessionId: string | null = null
  workflowId: string | null = null
  signal: AbortSignal
  private controller!: ReadableStreamDefaultController<WorkflowEventContext>
  constructor() {
    this.signal = new AbortController().signal
    this.stream = new ReadableStream<WorkflowEventContext>({
      start: (controller) => {
        this.controller = controller
      },
    })
    this.signal.addEventListener('abort', () => {
      this.controller.close()
    })
  }

  push(data: WorkflowEvent) {
    const record: WorkflowEventContext = {
      ...data,
      ctx: { sessionId: this.sessionId, workflowId: this.workflowId },
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
