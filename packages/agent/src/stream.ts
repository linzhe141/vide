import type { WorkflowEvent } from './event'

type WorkflowEventContext = WorkflowEvent & {
  ctx: {
    sessionId: string | null
    workflowId: string | null
    namespace: string | null
    mainWorkflowId: string | null
  }
}

type ReplayToolCallWithArguments = {
  function: {
    arguments: string
  }
}

function hasReplayToolCallArguments(value: unknown): value is ReplayToolCallWithArguments {
  if (!value || typeof value !== 'object') {
    return false
  }

  const functionValue = Reflect.get(value, 'function')
  if (!functionValue || typeof functionValue !== 'object') {
    return false
  }

  return typeof Reflect.get(functionValue, 'arguments') === 'string'
}

const MAX_REPLAY_STRING_LENGTH = 12_000

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

    this.recordReplayEvent(record)
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

  private recordReplayEvent(record: WorkflowEventContext) {
    const compactRecord = compactReplayEvent(record)

    if (mergeReplayDelta(this.recordedEvents, compactRecord)) {
      return
    }

    if (compactRecord.type === 'workflow.llm.reason.end') {
      collapseReplaySegment(
        this.recordedEvents,
        'workflow.llm.reason.start',
        'workflow.llm.reason.delta'
      )
    }

    if (compactRecord.type === 'workflow.llm.text.end') {
      collapseReplaySegment(
        this.recordedEvents,
        'workflow.llm.text.start',
        'workflow.llm.text.delta'
      )
    }

    this.recordedEvents.push(compactRecord)
  }
}

function compactReplayEvent(record: WorkflowEventContext): WorkflowEventContext {
  switch (record.type) {
    case 'workflow.step.start':
      return { ...record, payload: undefined }

    case 'workflow.step.end':
      return { ...record, result: undefined }

    case 'workflow.completed':
      return { ...record, result: '' }

    case 'workflow.llm.result':
      return {
        ...record,
        result: {
          role: 'assistant',
          content: '',
          ...(Array.isArray(record.result.tool_calls)
            ? {
                tool_calls: record.result.tool_calls.map((toolCall) =>
                  hasReplayToolCallArguments(toolCall)
                    ? compactReplayToolCallStub(toolCall)
                    : toolCall
                ),
              }
            : {}),
        },
      }

    case 'workflow.llm.tool.call.end':
      return {
        ...record,
        toolCall: record.toolCall.map(compactReplayToolCall),
      }

    case 'workflow.tool.call.start':
      return {
        ...record,
        toolCall: {
          ...record.toolCall,
          args: undefined,
        },
      }

    case 'workflow.tool.call.success':
      return {
        ...record,
        toolCallResult: {
          ...record.toolCallResult,
          result: compactReplayValue(record.toolCallResult.result),
        },
      }

    case 'workflow.tool.call.error':
      return {
        ...record,
        toolCallResult: {
          ...record.toolCallResult,
          error: compactReplayValue(record.toolCallResult.error),
        },
      }

    case 'workflow.error':
    case 'workflow.llm.error':
      return {
        ...record,
        error: compactReplayValue(record.error),
      }

    case 'workflow.custom':
      return {
        ...record,
        data: compactReplayValue(record.data),
      }

    default:
      return record
  }
}

function compactReplayToolCall<T extends ReplayToolCallWithArguments>(toolCall: T): T {
  return {
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: compactReplayArguments(toolCall.function.arguments),
    },
  }
}

function compactReplayToolCallStub<T extends ReplayToolCallWithArguments>(toolCall: T): T {
  return {
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: '',
    },
  }
}

function compactReplayArguments(argumentsText: string): string {
  if (argumentsText.length <= MAX_REPLAY_STRING_LENGTH) {
    return argumentsText
  }

  try {
    return JSON.stringify(compactReplayValue(JSON.parse(argumentsText)))
  } catch {
    return truncateReplayString(argumentsText)
  }
}

function compactReplayValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return truncateReplayString(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => compactReplayValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, compactReplayValue(entry)])
    )
  }

  return value
}

function truncateReplayString(value: string): string {
  if (value.length <= MAX_REPLAY_STRING_LENGTH) {
    return value
  }

  const omittedLength = value.length - MAX_REPLAY_STRING_LENGTH
  return `${value.slice(0, MAX_REPLAY_STRING_LENGTH)}\n...[truncated ${omittedLength} chars for replay]`
}

function mergeReplayDelta(events: WorkflowEventContext[], record: WorkflowEventContext) {
  const previous = events.at(-1)

  if (
    record.type === 'workflow.llm.reason.delta' &&
    previous?.type === 'workflow.llm.reason.delta'
  ) {
    previous.chunk.delta += record.chunk.delta
    return true
  }

  if (record.type === 'workflow.llm.text.delta' && previous?.type === 'workflow.llm.text.delta') {
    previous.chunk.delta += record.chunk.delta
    return true
  }

  return false
}

function collapseReplaySegment(
  events: WorkflowEventContext[],
  startType: 'workflow.llm.reason.start' | 'workflow.llm.text.start',
  deltaType: 'workflow.llm.reason.delta' | 'workflow.llm.text.delta'
) {
  let cursor = events.length - 1

  while (cursor >= 0) {
    const eventType = events[cursor]?.type
    if (eventType === startType || eventType === deltaType) {
      cursor -= 1
      continue
    }

    break
  }

  if (cursor < events.length - 1) {
    events.splice(cursor + 1)
  }
}
