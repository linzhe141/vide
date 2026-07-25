import type { WorkflowEventWithCtx } from './channels'

export class WorkflowStream {
  // sub agent 才存在
  namespace?: string
  mainWorkflowId?: string

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
    if (this.namespace) data.data.ctx.namespace = this.namespace
    if (this.mainWorkflowId) data.data.ctx.mainWorkflowId = this.mainWorkflowId
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
