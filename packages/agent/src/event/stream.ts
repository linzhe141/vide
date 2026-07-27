import type { WorkflowRuntimeEventWithCtx } from './channels'

export class WorkflowStream {
  // sub agent 才存在
  namespace?: string
  mainWorkflowId?: string

  stream: ReadableStream<WorkflowRuntimeEventWithCtx>
  events: WorkflowRuntimeEventWithCtx[] = []
  private controller!: ReadableStreamDefaultController<WorkflowRuntimeEventWithCtx>

  constructor() {
    this.stream = new ReadableStream<WorkflowRuntimeEventWithCtx>({
      start: (controller) => {
        this.controller = controller
      },
    })
  }

  push(data: WorkflowRuntimeEventWithCtx) {
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
