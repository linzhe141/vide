import type { WorkflowEventWithCtx } from './channels'

export class WorkflowStream {
  namespace?: string
  stream: ReadableStream<WorkflowEventWithCtx>
  events: WorkflowEventWithCtx[] = []
  private controller!: ReadableStreamDefaultController<WorkflowEventWithCtx>

  constructor() {
    this.stream = new ReadableStream<WorkflowEventWithCtx>({
      start: (controller) => {
        this.controller = controller
      },
    })
  }

  push(data: WorkflowEventWithCtx) {
    if (this.namespace) {
      data.data.ctx.namespace = this.namespace
    }
    this.events.push(data)
    this.controller.enqueue(data)
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
