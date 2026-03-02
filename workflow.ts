// ============================================================================
// Simplified Adaptive Agent (Simple + Planned only)
// ============================================================================

type AgentMode = 'simple' | 'planned'

type AgentState =
  | 'IDLE'
  | 'ANALYZING'
  | 'SIMPLE'
  | 'PLANNING'
  | 'EXECUTING_STEP'
  | 'WAITING_TOOL'
  | 'DONE'
  | 'ERROR'

interface AgentContext {
  userInput: string
  mode: AgentMode
  plan?: string[]
  currentStepIndex?: number
  conversation: ChatCompletionMessageParam[]
}

export class AdaptiveAgent {
  private state: AgentState = 'IDLE'
  private context: AgentContext
  private openai: OpenAI

  constructor(apiKey: string, userInput: string) {
    this.openai = new OpenAI({ apiKey })
    this.context = {
      userInput,
      mode: 'simple',
      conversation: [],
    }
  }

  // =========================================
  // STATE TRANSITION
  // =========================================

  private transition(next: AgentState) {
    console.log(`[STATE] ${this.state} -> ${next}`)
    this.state = next
  }

  // =========================================
  // MAIN RUN
  // =========================================

  async run() {
    try {
      this.transition('ANALYZING')
      await this.analyze()

      if (this.context.mode === 'simple') {
        await this.runSimple()
      } else {
        await this.runPlanned()
      }

      this.transition('DONE')
    } catch (err) {
      this.transition('ERROR')
      console.error(err)
    }
  }

  // =========================================
  // ANALYZE TASK
  // =========================================

  private async analyze() {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'user',
          content: `Classify task: ${this.context.userInput}
Return JSON { "mode": "simple" | "planned" }`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    this.context.mode = result.mode || 'simple'
  }

  // =========================================
  // SIMPLE MODE
  // =========================================

  private async runSimple() {
    this.transition('SIMPLE')

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: this.context.userInput }],
      tools,
      tool_choice: 'auto',
    })

    const message = completion.choices[0].message

    if (message.tool_calls?.length) {
      this.transition('WAITING_TOOL')

      for (const call of message.tool_calls) {
        const result = await this.executeTool(call)

        this.context.conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        })
      }

      // 再次请求 LLM
      await this.runSimple()
    } else {
      console.log('Final Answer:', message.content)
    }
  }

  // =========================================
  // PLANNED MODE
  // =========================================

  private async runPlanned() {
    this.transition('PLANNING')

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'user',
          content: `Create steps for: ${this.context.userInput}
Return JSON { "steps": [] }`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const data = JSON.parse(completion.choices[0].message.content || '{}')

    this.context.plan = data.steps || []
    this.context.currentStepIndex = 0

    while (this.context.currentStepIndex! < this.context.plan.length) {
      await this.executeStep()
      this.context.currentStepIndex!++
    }
  }

  private async executeStep() {
    this.transition('EXECUTING_STEP')

    const step = this.context.plan![this.context.currentStepIndex!]

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: step }],
      tools,
      tool_choice: 'auto',
    })

    const message = completion.choices[0].message

    if (message.tool_calls?.length) {
      this.transition('WAITING_TOOL')

      for (const call of message.tool_calls) {
        await this.executeTool(call)
      }

      await this.executeStep()
    } else {
      console.log(`Step result: ${message.content}`)
    }
  }

  // =========================================
  // TOOL EXECUTOR
  // =========================================

  private async executeTool(call: any) {
    const args = JSON.parse(call.function.arguments)

    switch (call.function.name) {
      case 'calculate':
        return { result: eval(args.expression) }
      default:
        return { error: 'Unknown tool' }
    }
  }
}
