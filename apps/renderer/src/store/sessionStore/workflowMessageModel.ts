import type { ToolCall } from '@vide/ai'
import type { WorkflowEvent } from '@vide/agent/event'
import { ASK_USER_QUESTION_TOOL_NAME, sanitizeAskUserQuestions } from './askQuestion'
import type {
  AskUserQuestionSessionMessage,
  AssistantReasonSessionMessage,
  AssistantTextSessionMessage,
  ErrorSessionMessage,
  ReasoningBlockItem,
  ReasoningBlockSessionMessage,
  Session,
  SessionMessage,
  ToolCallSessionMessage,
  ToolCallState,
  UserInputSessionMessage,
  Workflow,
  WorkflowLogEvent,
  WorkflowSessionMessage,
} from './types'

type WorkflowEventContext = {
  sessionId?: string | null
  workflowId?: string | null
  namespace?: string | null
  mainWorkflowId?: string | null
}

type WorkflowEventWithContext = WorkflowEvent & {
  ctx: WorkflowEventContext
}

type ReplayWorkflowState = {
  workflow: Workflow
  thinkingMode: boolean
  nextId: (kind: string) => string
  activeReasoningBlock: ReasoningBlockSessionMessage | null
  pendingText: AssistantTextSessionMessage | null
  nestedWorkflows: Map<string, ReplayWorkflowState>
}

export function createWorkflowUiModel(
  workflowId: string,
  input: string,
  inputSource: 'desktop' | 'wechat-bot'
): Workflow {
  return {
    id: workflowId,
    input,
    inputSource,
    feedback: null,
    events: [],
    messages: [
      {
        id: `${workflowId}:user`,
        role: 'user',
        content: input,
        inputSource,
        kind: 'root',
        pending: false,
      },
    ],
    runtime: {
      status: 'running',
      toolCallStatusOverrides: {},
      pendingSteeringMessages: [],
    },
  }
}

export function rebuildWorkflowMessages(workflow: Workflow, thinkingMode: boolean) {
  const previousMessages = workflow.messages
  const replayState = createReplayWorkflowState({
    workflowId: workflow.id,
    input: workflow.input,
    inputSource: workflow.inputSource,
    feedback: workflow.feedback,
    status: workflow.runtime.status,
    thinkingMode,
    toolCallStatusOverrides: workflow.runtime.toolCallStatusOverrides ?? {},
  })

  replayWorkflowEvents(replayState, workflow.events ?? [])
  finalizeReplayState(replayState)

  const nextMessages = reconcileSessionMessages(previousMessages, replayState.workflow.messages)
  const nextSubWorkflowId = replayState.workflow.subWorkflow?.id

  workflow.messages = nextMessages
  workflow.subWorkflow = nextSubWorkflowId
    ? findWorkflowMessageInMessages(nextMessages, nextSubWorkflowId)
    : undefined
  workflow.runtime.status = replayState.workflow.runtime.status
  workflow.runtime.toolCallStatusOverrides = replayState.workflow.runtime.toolCallStatusOverrides
}

export function findWorkflowInSession(session: Session, workflowId: string): Workflow | undefined {
  for (const node of Object.values(session.workflowNodesMap)) {
    const found = findWorkflowById(node.workflow, workflowId)
    if (found) {
      return found
    }
  }

  return undefined
}

export function findAskUserQuestionMessage(
  workflow: Workflow,
  messageId: string
): AskUserQuestionSessionMessage | undefined {
  return findAskQuestionInMessages(workflow.messages, messageId)
}

export function findLatestToolCallByName(
  workflow: Workflow,
  toolName: string
): ToolCallState | null {
  for (let index = workflow.messages.length - 1; index >= 0; index -= 1) {
    const message = workflow.messages[index]

    if (message.role === 'tool-call') {
      const match = [...message.toolCalls]
        .reverse()
        .find((item) => item.toolCall.function.name === toolName)
      if (match) {
        return match
      }
      continue
    }

    if (message.role !== 'reasoning-block') {
      continue
    }

    for (let itemIndex = message.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const item = message.items[itemIndex]
      if (item.role !== 'tool-call') {
        continue
      }

      const match = [...item.toolCalls]
        .reverse()
        .find((toolCallState) => toolCallState.toolCall.function.name === toolName)
      if (match) {
        return match
      }
    }
  }

  return null
}

export function findSubAgentWorkflowForToolCall(
  workflow: Workflow,
  toolCallId: string
): Workflow | undefined {
  for (let index = 0; index < workflow.messages.length; index += 1) {
    const message = workflow.messages[index]

    if (
      message.role === 'tool-call' &&
      message.toolCalls.some((item) => item.toolCall.id === toolCallId)
    ) {
      for (let nextIndex = index + 1; nextIndex < workflow.messages.length; nextIndex += 1) {
        const nextMessage = workflow.messages[nextIndex]
        if (nextMessage.role === 'workflow') {
          return nextMessage
        }
      }
    }

    if (message.role !== 'reasoning-block') {
      continue
    }

    for (let itemIndex = 0; itemIndex < message.items.length; itemIndex += 1) {
      const item = message.items[itemIndex]
      if (
        item.role !== 'tool-call' ||
        !item.toolCalls.some((state) => state.toolCall.id === toolCallId)
      ) {
        continue
      }

      for (let nextIndex = itemIndex + 1; nextIndex < message.items.length; nextIndex += 1) {
        const nextItem = message.items[nextIndex]
        if (nextItem.role === 'workflow') {
          return nextItem
        }
      }
    }
  }

  return undefined
}

export function getLastVisibleMessage(workflow: Workflow): SessionMessage | null {
  for (let index = workflow.messages.length - 1; index >= 0; index -= 1) {
    const message = workflow.messages[index]
    if (message.role === 'workflow') {
      continue
    }

    if (message.role !== 'reasoning-block') {
      return message
    }

    for (let itemIndex = message.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const item = message.items[itemIndex]
      if (item.role !== 'workflow') {
        return item
      }
    }
  }

  return null
}

export function getReasoningBlockSummary(message: ReasoningBlockSessionMessage) {
  for (let index = message.items.length - 1; index >= 0; index -= 1) {
    const item = message.items[index]
    if (item.role === 'assistant-reason' && item.content.trim()) {
      return item
    }
  }

  return null
}

function reconcileSessionMessages(
  previousMessages: SessionMessage[],
  nextMessages: SessionMessage[]
): SessionMessage[] {
  if (!previousMessages.length) {
    return nextMessages
  }

  let changed = previousMessages.length !== nextMessages.length
  const reconciledMessages = nextMessages.map((nextMessage, index) => {
    const previousMessage = previousMessages[index]
    const reconciledMessage = reconcileSessionMessage(previousMessage, nextMessage)
    if (reconciledMessage !== previousMessage) {
      changed = true
    }
    return reconciledMessage
  })

  return changed ? reconciledMessages : previousMessages
}

function reconcileSessionMessage(
  previousMessage: SessionMessage | undefined,
  nextMessage: SessionMessage
): SessionMessage {
  if (
    !previousMessage ||
    previousMessage.id !== nextMessage.id ||
    previousMessage.role !== nextMessage.role
  ) {
    return nextMessage
  }

  switch (nextMessage.role) {
    case 'user': {
      const previousUserMessage = previousMessage as UserInputSessionMessage
      return previousUserMessage.content === nextMessage.content &&
        previousUserMessage.inputSource === nextMessage.inputSource &&
        previousUserMessage.kind === nextMessage.kind &&
        previousUserMessage.pending === nextMessage.pending
        ? previousUserMessage
        : nextMessage
    }

    case 'assistant-reason': {
      const previousReasonMessage = previousMessage as AssistantReasonSessionMessage
      return previousReasonMessage.content === nextMessage.content &&
        previousReasonMessage.reasoning === nextMessage.reasoning
        ? previousReasonMessage
        : nextMessage
    }

    case 'assistant-text': {
      const previousTextMessage = previousMessage as AssistantTextSessionMessage
      return previousTextMessage.content === nextMessage.content &&
        previousTextMessage.streaming === nextMessage.streaming
        ? previousTextMessage
        : nextMessage
    }

    case 'ask-user-question': {
      const previousAskQuestionMessage = previousMessage as AskUserQuestionSessionMessage
      return previousAskQuestionMessage.toolCallId === nextMessage.toolCallId &&
        areAskQuestionItemsEqual(previousAskQuestionMessage.questions, nextMessage.questions)
        ? previousAskQuestionMessage
        : nextMessage
    }

    case 'error': {
      const previousErrorMessage = previousMessage as ErrorSessionMessage
      return Object.is(previousErrorMessage.error, nextMessage.error)
        ? previousErrorMessage
        : nextMessage
    }

    case 'tool-call': {
      const previousToolCallMessage = previousMessage as ToolCallSessionMessage
      const toolCalls = reconcileToolCallStates(
        previousToolCallMessage.toolCalls,
        nextMessage.toolCalls
      )
      if (toolCalls === previousToolCallMessage.toolCalls) {
        return previousToolCallMessage
      }

      return {
        ...nextMessage,
        toolCalls,
      }
    }

    case 'reasoning-block': {
      const previousReasoningBlock = previousMessage as ReasoningBlockSessionMessage
      const items = reconcileReasoningBlockItems(previousReasoningBlock.items, nextMessage.items)
      if (items === previousReasoningBlock.items) {
        return previousReasoningBlock
      }

      return {
        ...nextMessage,
        items,
      }
    }

    case 'workflow':
      return reconcileWorkflowMessage(previousMessage as WorkflowSessionMessage, nextMessage)
  }
}

function reconcileReasoningBlockItems(
  previousItems: ReasoningBlockItem[],
  nextItems: ReasoningBlockItem[]
): ReasoningBlockItem[] {
  if (!previousItems.length) {
    return nextItems
  }

  let changed = previousItems.length !== nextItems.length
  const reconciledItems = nextItems.map((nextItem, index) => {
    const previousItem = previousItems[index] as SessionMessage | undefined
    const reconciledItem = reconcileSessionMessage(previousItem, nextItem as SessionMessage)
    if (reconciledItem !== previousItem) {
      changed = true
    }
    return reconciledItem as ReasoningBlockItem
  })

  return changed ? reconciledItems : previousItems
}

function reconcileWorkflowMessage(
  previousWorkflow: WorkflowSessionMessage,
  nextWorkflow: WorkflowSessionMessage
): WorkflowSessionMessage {
  const messages = reconcileSessionMessages(previousWorkflow.messages, nextWorkflow.messages)
  const toolCallStatusOverrides = reconcileToolCallStatusOverrides(
    previousWorkflow.runtime.toolCallStatusOverrides,
    nextWorkflow.runtime.toolCallStatusOverrides
  )
  const subWorkflow = nextWorkflow.subWorkflow?.id
    ? findWorkflowMessageInMessages(messages, nextWorkflow.subWorkflow.id)
    : undefined

  const unchanged =
    previousWorkflow.input === nextWorkflow.input &&
    previousWorkflow.inputSource === nextWorkflow.inputSource &&
    previousWorkflow.feedback === nextWorkflow.feedback &&
    previousWorkflow.runtime.status === nextWorkflow.runtime.status &&
    messages === previousWorkflow.messages &&
    toolCallStatusOverrides === previousWorkflow.runtime.toolCallStatusOverrides &&
    previousWorkflow.subWorkflow === subWorkflow

  if (unchanged) {
    return previousWorkflow
  }

  return {
    ...nextWorkflow,
    messages,
    runtime: {
      ...nextWorkflow.runtime,
      toolCallStatusOverrides,
    },
    subWorkflow,
  }
}

function reconcileToolCallStates(
  previousStates: ToolCallState[],
  nextStates: ToolCallState[]
): ToolCallState[] {
  if (!previousStates.length) {
    return nextStates
  }

  let changed = previousStates.length !== nextStates.length
  const reconciledStates = nextStates.map((nextState, index) => {
    const previousState = previousStates[index]
    if (!previousState || previousState.toolCall.id !== nextState.toolCall.id) {
      changed = true
      return nextState
    }

    if (areToolCallStatesEqual(previousState, nextState)) {
      return previousState
    }

    changed = true
    return nextState
  })

  return changed ? reconciledStates : previousStates
}

function areToolCallStatesEqual(previousState: ToolCallState, nextState: ToolCallState) {
  return (
    areToolCallsEqual(previousState.toolCall, nextState.toolCall) &&
    areToolCallResultsEqual(previousState.result, nextState.result)
  )
}

function areToolCallsEqual(
  previousToolCall: ToolCallState['toolCall'],
  nextToolCall: ToolCallState['toolCall']
) {
  return (
    previousToolCall.id === nextToolCall.id &&
    previousToolCall.status === nextToolCall.status &&
    previousToolCall.function.name === nextToolCall.function.name &&
    previousToolCall.function.arguments === nextToolCall.function.arguments
  )
}

function areToolCallResultsEqual(
  previousResult: ToolCallState['result'],
  nextResult: ToolCallState['result']
) {
  if (previousResult === nextResult) {
    return true
  }

  if (!previousResult || !nextResult) {
    return previousResult === nextResult
  }

  return (
    previousResult.status === nextResult.status &&
    previousResult.startedAt === nextResult.startedAt &&
    previousResult.finishedAt === nextResult.finishedAt &&
    previousResult.durationMs === nextResult.durationMs &&
    Object.is(previousResult.result, nextResult.result) &&
    Object.is(previousResult.error, nextResult.error)
  )
}

function reconcileToolCallStatusOverrides(
  previousOverrides?: Record<string, ToolCall['status']>,
  nextOverrides?: Record<string, ToolCall['status']>
) {
  if (!previousOverrides || !nextOverrides) {
    return nextOverrides
  }

  const previousKeys = Object.keys(previousOverrides)
  const nextKeys = Object.keys(nextOverrides)
  if (previousKeys.length !== nextKeys.length) {
    return nextOverrides
  }

  for (const key of nextKeys) {
    if (previousOverrides[key] !== nextOverrides[key]) {
      return nextOverrides
    }
  }

  return previousOverrides
}

function areAskQuestionItemsEqual(
  previousQuestions: AskUserQuestionSessionMessage['questions'],
  nextQuestions: AskUserQuestionSessionMessage['questions']
) {
  if (previousQuestions.length !== nextQuestions.length) {
    return false
  }

  for (let index = 0; index < nextQuestions.length; index += 1) {
    const previousQuestion = previousQuestions[index]
    const nextQuestion = nextQuestions[index]
    if (!previousQuestion || !nextQuestion) {
      return false
    }

    if (
      previousQuestion.id !== nextQuestion.id ||
      previousQuestion.title !== nextQuestion.title ||
      previousQuestion.description !== nextQuestion.description ||
      !areAskQuestionOptionsEqual(previousQuestion.options, nextQuestion.options) ||
      previousQuestion.answer?.selected !== nextQuestion.answer?.selected ||
      previousQuestion.answer?.other !== nextQuestion.answer?.other
    ) {
      return false
    }
  }

  return true
}

function areAskQuestionOptionsEqual(
  previousOptions: AskUserQuestionSessionMessage['questions'][number]['options'],
  nextOptions: AskUserQuestionSessionMessage['questions'][number]['options']
) {
  if (previousOptions.length !== nextOptions.length) {
    return false
  }

  for (let index = 0; index < nextOptions.length; index += 1) {
    const previousOption = previousOptions[index]
    const nextOption = nextOptions[index]
    if (
      !previousOption ||
      !nextOption ||
      previousOption.label !== nextOption.label ||
      previousOption.value !== nextOption.value
    ) {
      return false
    }
  }

  return true
}

function findWorkflowMessageInMessages(
  messages: SessionMessage[],
  workflowId: string
): WorkflowSessionMessage | undefined {
  for (const message of messages) {
    if (message.role === 'workflow' && message.id === workflowId) {
      return message
    }

    if (message.role === 'workflow') {
      const nested = findWorkflowMessageInMessages(message.messages, workflowId)
      if (nested) {
        return nested
      }
      continue
    }

    if (message.role !== 'reasoning-block') {
      continue
    }

    for (const item of message.items) {
      if (item.role !== 'workflow') {
        continue
      }

      if (item.id === workflowId) {
        return item
      }

      const nested = findWorkflowMessageInMessages(item.messages, workflowId)
      if (nested) {
        return nested
      }
    }
  }

  return undefined
}

function createReplayWorkflowState(data: {
  workflowId: string
  input: string
  inputSource: 'desktop' | 'wechat-bot'
  feedback: Workflow['feedback']
  status: Workflow['runtime']['status']
  thinkingMode: boolean
  toolCallStatusOverrides: Record<string, ToolCall['status']>
}): ReplayWorkflowState {
  const workflow = createWorkflowUiModel(data.workflowId, data.input, data.inputSource)
  workflow.feedback = data.feedback
  workflow.runtime.status = data.status
  workflow.runtime.toolCallStatusOverrides = { ...data.toolCallStatusOverrides }

  return {
    workflow,
    thinkingMode: data.thinkingMode,
    nextId: createIdFactory(data.workflowId),
    activeReasoningBlock: null,
    pendingText: null,
    nestedWorkflows: new Map(),
  }
}

function replayWorkflowEvents(state: ReplayWorkflowState, events: WorkflowLogEvent[]) {
  for (const eventRecord of events) {
    const event = toWorkflowEvent(eventRecord)
    if (!event) {
      continue
    }

    if (event.type === 'workflow.custom' && event.eventName === 'sub-agent.event') {
      const nestedEvent = toNestedWorkflowEvent(event.data)
      if (!nestedEvent?.ctx.workflowId) {
        continue
      }

      let nestedState = state.nestedWorkflows.get(nestedEvent.ctx.workflowId)
      if (!nestedState) {
        if (nestedEvent.type !== 'workflow.start') {
          continue
        }

        nestedState = createReplayWorkflowState({
          workflowId: nestedEvent.ctx.workflowId,
          input: nestedEvent.input,
          inputSource: nestedEvent.inputSource,
          feedback: null,
          status: 'running',
          thinkingMode: state.thinkingMode,
          toolCallStatusOverrides: {},
        })
        state.nestedWorkflows.set(nestedEvent.ctx.workflowId, nestedState)
        attachNestedWorkflow(state, nestedState.workflow)
      }

      applyWorkflowEventToState(nestedState, nestedEvent)
      continue
    }

    applyWorkflowEventToState(state, event)
  }
}

function finalizeReplayState(state: ReplayWorkflowState) {
  for (const nestedState of state.nestedWorkflows.values()) {
    finalizeReplayState(nestedState)
  }

  if (!state.pendingText) {
    return
  }

  if (!state.pendingText.content && !state.pendingText.streaming) {
    state.pendingText = null
    return
  }

  state.workflow.messages.push(state.pendingText)
  state.pendingText = null
}

function applyWorkflowEventToState(
  state: ReplayWorkflowState,
  event: WorkflowEvent | WorkflowEventWithContext
) {
  if (state.thinkingMode) {
    applyThinkingModeEvent(state, event)
    return
  }

  applyFlatModeEvent(state, event)
}

function applyThinkingModeEvent(
  state: ReplayWorkflowState,
  event: WorkflowEvent | WorkflowEventWithContext
) {
  switch (event.type) {
    case 'workflow.start':
    case 'workflow.step.start':
    case 'workflow.step.end':
    case 'workflow.llm.start':
    case 'workflow.llm.end':
    case 'workflow.llm.tool.call.process':
      return

    case 'workflow.completed':
      state.workflow.runtime.status = 'finished'
      state.activeReasoningBlock = null
      return

    case 'workflow.interrupted':
      state.workflow.runtime.status = 'interrupted'
      return

    case 'workflow.aborted':
      state.workflow.runtime.status = 'aborted'
      state.activeReasoningBlock = null
      return

    case 'workflow.error':
      state.workflow.runtime.status = 'error'
      state.activeReasoningBlock = null
      return

    case 'workflow.llm.error': {
      state.workflow.runtime.status = 'error'
      const errorMessage: ErrorSessionMessage = {
        id: state.nextId('error'),
        role: 'error',
        error: event.error instanceof Error ? event.error.message : event.error,
      }

      if (state.activeReasoningBlock) {
        state.activeReasoningBlock.items.push(errorMessage)
      } else {
        state.workflow.messages.push(errorMessage)
      }
      return
    }

    case 'workflow.llm.reason.start': {
      const reasonMessage = ensureReasoningBlockReasonMessage(state)
      reasonMessage.reasoning = true
      return
    }

    case 'workflow.llm.reason.delta': {
      const reasonMessage = ensureReasoningBlockReasonMessage(state)
      reasonMessage.content += event.chunk.delta
      return
    }

    case 'workflow.llm.reason.end': {
      const reasonMessage = ensureReasoningBlockReasonMessage(state)
      reasonMessage.content = event.content
      reasonMessage.reasoning = false
      return
    }

    case 'workflow.llm.text.start': {
      const textMessage = ensurePendingTextMessage(state)
      textMessage.streaming = true
      return
    }

    case 'workflow.llm.text.delta': {
      const textMessage = ensurePendingTextMessage(state)
      textMessage.content += event.chunk.delta
      return
    }

    case 'workflow.llm.text.end': {
      const textMessage = ensurePendingTextMessage(state)
      textMessage.content = event.content
      textMessage.streaming = false
      return
    }

    case 'workflow.llm.tool.call.end': {
      const flushedText = flushPendingTextOutsideReasoningBlock(state)
      if (flushedText) {
        state.activeReasoningBlock = null
      }
      appendToolCallMessages(state, ensureReasoningBlock(state).items, event.toolCall)
      return
    }

    case 'workflow.context.input': {
      flushPendingTextOutsideReasoningBlock(state)
      state.activeReasoningBlock = null
      state.workflow.messages.push({
        id: event.messageId,
        role: 'user',
        content: event.input,
        inputSource: event.inputSource,
        kind: 'steering',
        pending: false,
      })
      return
    }

    case 'workflow.llm.result': {
      const hasToolCalls =
        Array.isArray(event.result.tool_calls) && event.result.tool_calls.length > 0
      if (hasToolCalls) {
        const flushedText = flushPendingTextOutsideReasoningBlock(state)
        if (flushedText) {
          state.activeReasoningBlock = null
        }
      } else {
        flushPendingTextOutsideReasoningBlock(state)
        state.activeReasoningBlock = null
      }
      return
    }

    case 'workflow.tool.call.start':
      return

    case 'workflow.tool.call.success': {
      const toolCallState = findToolCallStateInMessages(
        state.workflow.messages,
        event.toolCallResult.id
      )
      if (toolCallState) {
        toolCallState.result = {
          status: 'success',
          result: event.toolCallResult.result,
          startedAt: event.toolCallResult.startedAt,
          finishedAt: event.toolCallResult.finishedAt,
          durationMs: event.toolCallResult.durationMs,
        }
      }
      return
    }

    case 'workflow.tool.call.error': {
      const toolCallState = findToolCallStateInMessages(
        state.workflow.messages,
        event.toolCallResult.id
      )
      if (toolCallState) {
        toolCallState.result = {
          status: 'error',
          error: event.toolCallResult.error,
        }
      }
      return
    }

    case 'workflow.custom':
      return
  }
}

function applyFlatModeEvent(
  state: ReplayWorkflowState,
  event: WorkflowEvent | WorkflowEventWithContext
) {
  switch (event.type) {
    case 'workflow.start':
    case 'workflow.step.start':
    case 'workflow.step.end':
    case 'workflow.llm.start':
    case 'workflow.llm.end':
    case 'workflow.llm.result':
    case 'workflow.llm.tool.call.process':
    case 'workflow.tool.call.start':
    case 'workflow.custom':
      return

    case 'workflow.completed':
      state.workflow.runtime.status = 'finished'
      return

    case 'workflow.interrupted':
      state.workflow.runtime.status = 'interrupted'
      return

    case 'workflow.aborted':
      state.workflow.runtime.status = 'aborted'
      return

    case 'workflow.error':
      state.workflow.runtime.status = 'error'
      return

    case 'workflow.llm.error':
      state.workflow.runtime.status = 'error'
      state.workflow.messages.push({
        id: state.nextId('error'),
        role: 'error',
        error: event.error instanceof Error ? event.error.message : event.error,
      })
      return

    case 'workflow.llm.reason.start': {
      const reasoningMessage = ensureFlatTailMessage(state, 'assistant-reason')
      reasoningMessage.reasoning = true
      return
    }

    case 'workflow.llm.reason.delta': {
      const reasoningMessage = ensureFlatTailMessage(state, 'assistant-reason')
      reasoningMessage.content += event.chunk.delta
      return
    }

    case 'workflow.llm.reason.end': {
      const reasoningMessage = ensureFlatTailMessage(state, 'assistant-reason')
      reasoningMessage.content = event.content
      reasoningMessage.reasoning = false
      return
    }

    case 'workflow.llm.text.start': {
      const textMessage = ensureFlatTailMessage(state, 'assistant-text')
      textMessage.streaming = true
      return
    }

    case 'workflow.llm.text.delta': {
      const textMessage = ensureFlatTailMessage(state, 'assistant-text')
      textMessage.content += event.chunk.delta
      return
    }

    case 'workflow.llm.text.end': {
      const textMessage = ensureFlatTailMessage(state, 'assistant-text')
      textMessage.content = event.content
      textMessage.streaming = false
      return
    }

    case 'workflow.context.input':
      state.workflow.messages.push({
        id: event.messageId,
        role: 'user',
        content: event.input,
        inputSource: event.inputSource,
        kind: 'steering',
        pending: false,
      })
      return

    case 'workflow.llm.tool.call.end':
      appendToolCallMessages(state, state.workflow.messages, event.toolCall)
      return

    case 'workflow.tool.call.success': {
      const toolCallState = findToolCallStateInMessages(
        state.workflow.messages,
        event.toolCallResult.id
      )
      if (toolCallState) {
        toolCallState.result = {
          status: 'success',
          result: event.toolCallResult.result,
          startedAt: event.toolCallResult.startedAt,
          finishedAt: event.toolCallResult.finishedAt,
          durationMs: event.toolCallResult.durationMs,
        }
      }
      return
    }

    case 'workflow.tool.call.error': {
      const toolCallState = findToolCallStateInMessages(
        state.workflow.messages,
        event.toolCallResult.id
      )
      if (toolCallState) {
        toolCallState.result = {
          status: 'error',
          error: event.toolCallResult.error,
        }
      }
      return
    }
  }
}

function attachNestedWorkflow(state: ReplayWorkflowState, nestedWorkflow: Workflow) {
  const workflowMessage: WorkflowSessionMessage = {
    role: 'workflow',
    ...nestedWorkflow,
  }

  if (state.thinkingMode && state.activeReasoningBlock) {
    state.activeReasoningBlock.items.push(workflowMessage)
  } else {
    state.workflow.messages.push(workflowMessage)
  }
  state.workflow.subWorkflow = workflowMessage
}

function ensureReasoningBlock(state: ReplayWorkflowState) {
  if (state.activeReasoningBlock) {
    return state.activeReasoningBlock
  }

  const message: ReasoningBlockSessionMessage = {
    id: state.nextId('reasoning-block'),
    role: 'reasoning-block',
    items: [],
  }
  state.workflow.messages.push(message)
  state.activeReasoningBlock = message
  return message
}

function ensureReasoningBlockReasonMessage(state: ReplayWorkflowState) {
  const block = ensureReasoningBlock(state)
  const last = block.items.at(-1)
  if (last?.role === 'assistant-reason' && last.reasoning) {
    return last
  }

  if (last?.role === 'assistant-reason' && !last.content) {
    return last
  }

  const message: AssistantReasonSessionMessage = {
    id: state.nextId('assistant-reason'),
    role: 'assistant-reason',
    content: '',
    reasoning: false,
  }
  block.items.push(message)
  return message
}

function ensurePendingTextMessage(state: ReplayWorkflowState) {
  if (state.pendingText) {
    return state.pendingText
  }

  state.pendingText = {
    id: state.nextId('assistant-text'),
    role: 'assistant-text',
    content: '',
    streaming: false,
  }
  return state.pendingText
}

function flushPendingTextOutsideReasoningBlock(state: ReplayWorkflowState) {
  if (!state.pendingText) {
    return false
  }

  if (!state.pendingText.content && !state.pendingText.streaming) {
    state.pendingText = null
    return false
  }

  state.workflow.messages.push(state.pendingText)
  state.pendingText = null
  return true
}

function ensureFlatTailMessage(
  state: ReplayWorkflowState,
  role: 'assistant-reason'
): AssistantReasonSessionMessage
function ensureFlatTailMessage(
  state: ReplayWorkflowState,
  role: 'assistant-text'
): AssistantTextSessionMessage
function ensureFlatTailMessage(
  state: ReplayWorkflowState,
  role: 'assistant-reason' | 'assistant-text'
) {
  const last = state.workflow.messages.at(-1)
  if (last?.role === role) {
    return last
  }

  if (role === 'assistant-reason') {
    const message: AssistantReasonSessionMessage = {
      id: state.nextId('assistant-reason'),
      role,
      content: '',
      reasoning: false,
    }
    state.workflow.messages.push(message)
    return message
  }

  const message: AssistantTextSessionMessage = {
    id: state.nextId('assistant-text'),
    role,
    content: '',
    streaming: false,
  }
  state.workflow.messages.push(message)
  return message
}

function appendToolCallMessages(
  state: ReplayWorkflowState,
  target: Array<SessionMessage | WorkflowSessionMessage>,
  toolCalls: ToolCall[]
) {
  const askQuestionToolCalls = toolCalls.filter(
    (toolCall) => toolCall.function.name === ASK_USER_QUESTION_TOOL_NAME
  )
  for (const toolCall of askQuestionToolCalls) {
    const args = parseToolArguments(toolCall.function.arguments)
    const questions = sanitizeAskUserQuestions(args?.questions, {
      createId: (index) => `${state.workflow.id}:question:${toolCall.id}:${index}`,
    })
    if (!questions.length) {
      continue
    }

    const askQuestionMessage: AskUserQuestionSessionMessage = {
      id: `${state.workflow.id}:ask:${toolCall.id}`,
      role: 'ask-user-question',
      toolCallId: toolCall.id,
      questions,
    }
    state.workflow.messages.push(askQuestionMessage)
  }

  const visibleToolCalls = toolCalls.filter(
    (toolCall) => toolCall.function.name !== ASK_USER_QUESTION_TOOL_NAME
  )
  if (!visibleToolCalls.length) {
    return
  }

  const toolCallMessage: ToolCallSessionMessage = {
    id: `${state.workflow.id}:tool-batch:${visibleToolCalls[0].id}`,
    role: 'tool-call',
    toolCalls: visibleToolCalls.map((toolCall) => ({
      toolCall: cloneToolCall(
        toolCall,
        state.workflow.runtime.toolCallStatusOverrides?.[toolCall.id]
      ),
    })),
  }
  target.push(toolCallMessage)
}

function cloneToolCall(toolCall: ToolCall, overrideStatus?: ToolCall['status']): ToolCall {
  return {
    ...toolCall,
    function: {
      ...toolCall.function,
    },
    status: overrideStatus ?? toolCall.status,
  }
}

function parseToolArguments(argumentsText: string): Record<string, unknown> | null {
  try {
    return JSON.parse(argumentsText) as Record<string, unknown>
  } catch {
    return null
  }
}

function findToolCallStateInMessages(
  messages: SessionMessage[],
  toolCallId: string
): ToolCallState | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (message.role === 'tool-call') {
      const toolCallState = message.toolCalls.find((item) => item.toolCall.id === toolCallId)
      if (toolCallState) {
        return toolCallState
      }
      continue
    }

    if (message.role === 'workflow') {
      const nested = findToolCallStateInMessages(message.messages, toolCallId)
      if (nested) {
        return nested
      }
      continue
    }

    if (message.role !== 'reasoning-block') {
      continue
    }

    for (let itemIndex = message.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const item = message.items[itemIndex]
      if (item.role === 'tool-call') {
        const toolCallState = item.toolCalls.find(
          (candidate) => candidate.toolCall.id === toolCallId
        )
        if (toolCallState) {
          return toolCallState
        }
        continue
      }

      if (item.role === 'workflow') {
        const nested = findToolCallStateInMessages(item.messages, toolCallId)
        if (nested) {
          return nested
        }
      }
    }
  }

  return undefined
}

function findAskQuestionInMessages(
  messages: SessionMessage[],
  messageId: string
): AskUserQuestionSessionMessage | undefined {
  for (const message of messages) {
    if (message.role === 'ask-user-question' && message.id === messageId) {
      return message
    }

    if (message.role === 'workflow') {
      const nested = findAskQuestionInMessages(message.messages, messageId)
      if (nested) {
        return nested
      }
      continue
    }

    if (message.role !== 'reasoning-block') {
      continue
    }

    for (const item of message.items) {
      if (item.role === 'workflow') {
        const nested = findAskQuestionInMessages(item.messages, messageId)
        if (nested) {
          return nested
        }
      }
    }
  }

  return undefined
}

function findWorkflowById(workflow: Workflow, workflowId: string): Workflow | undefined {
  if (workflow.id === workflowId) {
    return workflow
  }

  for (const message of workflow.messages) {
    if (message.role === 'workflow') {
      const nested = findWorkflowById(message, workflowId)
      if (nested) {
        return nested
      }
      continue
    }

    if (message.role !== 'reasoning-block') {
      continue
    }

    for (const item of message.items) {
      if (item.role !== 'workflow') {
        continue
      }
      const nested = findWorkflowById(item, workflowId)
      if (nested) {
        return nested
      }
    }
  }

  return undefined
}

function toWorkflowEvent(eventRecord: WorkflowLogEvent): WorkflowEvent | null {
  if (!eventRecord.payload || typeof eventRecord.payload !== 'object') {
    return null
  }

  const payload = eventRecord.payload as Record<string, unknown>
  if (typeof payload.type === 'string') {
    return payload as unknown as WorkflowEvent
  }

  return {
    ...payload,
    type: eventRecord.type,
  } as WorkflowEvent
}

function toNestedWorkflowEvent(data: unknown): WorkflowEventWithContext | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const candidate = data as Partial<WorkflowEventWithContext>
  if (!candidate.type || !candidate.ctx || typeof candidate.ctx !== 'object') {
    return null
  }

  return candidate as WorkflowEventWithContext
}

function createIdFactory(prefix: string) {
  let counter = 0
  return (kind: string) => `${prefix}:${kind}:${counter++}`
}
