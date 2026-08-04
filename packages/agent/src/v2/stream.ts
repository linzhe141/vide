import type { WorkflowEvent } from './event'

export class WorkflowStream {
  recordedEvents: WorkflowEvent[] = []
  stream: ReadableStream<WorkflowEvent>
  signal: AbortSignal
  private controller!: ReadableStreamDefaultController<WorkflowEvent>
  constructor() {
    this.signal = new AbortController().signal
    this.stream = new ReadableStream<WorkflowEvent>({
      start: (controller) => {
        this.controller = controller
      },
    })
    this.signal.addEventListener('abort', () => {
      this.controller.close()
    })
  }

  push(data: WorkflowEvent) {
    this.recordedEvents.push(data)
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
