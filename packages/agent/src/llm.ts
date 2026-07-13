import { AgentSystemPrompt } from './prompt/system'
import { buildSkillsChatMessage } from './tools/skill'
import { AbortError } from './error'
import {
  buildUserMemoryChatMessage,
  updateUserMemoryFromConversation,
  type UserMemoryFeedback,
} from './memory/userMemory'
import {
  type AI,
  createLLMClient as createAIClient,
  processLLMStream as processStream,
  type Tool,
  type ChatMessage,
  type ToolCall,
} from '@vide/ai'

let model: string = null!
export let llmClient: AI = null!

export function createLLMClient(options: { apiKey: string; baseURL: string; model: string }) {
  llmClient = createAIClient({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  })
  model = options.model
}

export function updateUserMemory(messages: ChatMessage[], feedback?: UserMemoryFeedback) {
  const activeClient = llmClient
  const activeModel = model
  if (!activeClient || !activeModel) {
    throw new Error('LLM client is not initialized. Please goto LLM Settings.')
  }
  return updateUserMemoryFromConversation({
    messages,
    llmClient: activeClient,
    model: activeModel,
    feedback,
  })
}

type FnCallAI = (data: {
  messages: ChatMessage[]
  tools: Tool[]
  signal: AbortSignal
  workspace: string | null
  events: {
    onReasoningStart?: () => void
    onReasoningDelta?: (chunk: { delta: string; content: string }) => void
    onReasoningEnd?: (content: string) => void

    onTextStart?: () => void
    onTextDelta?: (chunk: { delta: string; content: string }) => void
    onTextEnd?: (content: string) => void

    onToolCallsStart?: () => void
    onToolCallName?: (data: { id: string; name: string }) => void
    onToolCallArguments?: (data: { id: string; arguments: string }) => void
    onToolCallsEnd?: (toolCalls: ToolCall[]) => void
  }
}) => Promise<{ content: string; toolCalls: ToolCall[] }>

export const callAI: FnCallAI = async function ({ messages, tools, signal, events, workspace }) {
  try {
    console.log('singal in processLLMStream', signal)
    let content = ''
    let toolCalls: ToolCall[] = []
    if (!llmClient) {
      throw new Error('LLM client is not initialized. Please goto LLM Settings.')
    }
    const stream = llmClient.chat.completions.create(
      {
        messages: await buildChatMessages(messages, workspace),
        model,
        stream: true,
        tools,
        reasoning_effort: 'medium',
      },
      { signal }
    )

    for await (const chunk of processStream(stream as any, events)) {
      if ('content' in chunk && chunk.content) {
        content = chunk.content
      }

      if ('tool_calls' in chunk && chunk.tool_calls) {
        toolCalls = chunk.tool_calls
      }
    }
    return { content, toolCalls }
  } catch (error: any) {
    console.error('Error in processLLMStream:', error)
    if (error.name === 'AbortError') {
      console.error('Stream was aborted by user')
      // 统一抛出 AbortError，方便上层捕获和处理
      throw new AbortError()
    }
    console.error('Error in processLLMStream:', error)
    // 其他错误继续往上抛
    throw error
  }
}

async function buildChatMessages(
  messages: ChatMessage[],
  workspace: string | null
): Promise<ChatMessage[]> {
  const skillsChatMessage = await buildSkillsChatMessage()
  const userMemoryChatMessage = await buildUserMemoryChatMessage()
  // console.log(skillsChatMessage)
  const chatMessages: ChatMessage[] = [
    {
      role: 'system',
      content: AgentSystemPrompt,
    },
  ]
  if (workspace) {
    chatMessages.push({
      role: 'system',
      content: `You are working in the workspace located at: ${workspace}`,
    })
  }
  if (userMemoryChatMessage) {
    chatMessages.push(userMemoryChatMessage)
  }
  if (skillsChatMessage) {
    chatMessages.push(skillsChatMessage)
  }
  chatMessages.push(...messages)

  return chatMessages
}
