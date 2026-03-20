import { nanoid } from "nanoid"
import type { ConversationBlock, ThreadMessage, ThreadState } from "."
import type { WorkflowState } from "../../hooks/createWorkflowStream"

export class ThreadEventHandler {
  constructor(
    private state: ThreadState,
    private event: WorkflowState
  ) {}

  run() {
    const { type, data } = this.event

    let block = getCurrentBlock(this.state)

    switch (type) {
      /* ---------------- workflow lifecycle ---------------- */

      case 'workflow-start': {
        this.state.streaming = true

        const workflowId = data.ctx.workflowId
        block = {
          id: workflowId,
          input: data.input,
          status: 'running',

          messages: [
            {
              id: nanoid(),
              role: 'user',
              content: data.input,
            },
          ],

          runtime: {
            isStreaming: false,
            streamingReason: false,
            streamingText: false,
            waitingHuman: false,
          },
        }

        this.state.blocks.push(block)
        this.state.currentBlockId = workflowId

        return
      }

      case 'workflow-finished': {
        this.state.streaming = false

        if (!block) return

        block.status = 'finished'
        block.runtime.isStreaming = false

        return
      }

      case 'workflow-error': {
        this.state.streaming = false
        if (!block) return

        console.error(data)

        block.status = 'error'

        pushMessage(block, {
          id: nanoid(),
          role: 'error',
          error: data.error,
        })

        return
      }

      case 'workflow-wait-human-approve': {
        if (!block) return

        block.runtime.waitingHuman = true
        return
      }

      /* ---------------- llm lifecycle ---------------- */

      case 'workflow-llm-start': {
        if (!block) return

        block.runtime.isStreaming = true
        return
      }

      case 'workflow-llm-end': {
        if (!block) return

        block.runtime.isStreaming = false
        block.runtime.streamingReason = false
        block.runtime.streamingText = false

        return
      }

      /* ---------------- reasoning stream ---------------- */

      case 'workflow-llm-reasoning-start': {
        if (!block) return

        block.runtime.streamingReason = true
        return
      }

      case 'workflow-llm-reasoning-delta': {
        if (!block) return

        const msg = ensureLastMessage(block, 'assistant-reason')
        msg.content += data.chunk.delta

        return
      }

      case 'workflow-llm-reasoning-end': {
        if (!block) return

        block.runtime.streamingReason = false
        return
      }

      /* ---------------- assistant text ---------------- */

      case 'workflow-llm-text-start': {
        if (!block) return

        block.runtime.streamingText = true
        return
      }

      case 'workflow-llm-text-delta': {
        if (!block) return

        const msg = ensureLastMessage(block, 'assistant-text')
        msg.content += data.chunk.delta

        return
      }

      case 'workflow-llm-text-end': {
        if (!block) return

        block.runtime.streamingText = false
        return
      }

      /* ---------------- tool calls ---------------- */

      case 'workflow-llm-tool-calls-end': {
        if (!block) return

        pushMessage(block, {
          id: nanoid(),
          role: 'tool-call',
          toolCalls: data.toolCalls,
        })

        return
      }

      /* ---------------- tool execution ---------------- */

      case 'workflow-tool-call-start': {
        if (!block) return

        block.runtime.runningToolId = data.toolCall.id
        return
      }

      case 'workflow-tool-call-success': {
        if (!block) return

        block.runtime.runningToolId = undefined

        pushMessage(block, {
          id: nanoid(),
          role: 'tool-result',
          toolCallId: data.toolCallResult.id,
          result: data.toolCallResult.result,
        })

        return
      }

      case 'workflow-tool-call-error': {
        if (!block) return

        block.runtime.runningToolId = undefined

        pushMessage(block, {
          id: nanoid(),
          role: 'error',
          error: data.toolCallResult.error,
        })

        return
      }

      /* ---------------- ask user ---------------- */

      case 'ask-user-start-generate': {
        if (!block) return

        block.askUser = {
          completed: false,
          submitValue: [],
          title: data.title,
          description: data.description,
          type: data.type,
          options: [],
        }

        return
      }

      case 'ask-user-option': {
        if (!block) return

        if (block.askUser) {
          block.askUser.options.push(data.option)
        }

        return
      }

      case 'ask-user-complete': {
        if (!block) return

        if (block.askUser) {
          block.askUser.completed = true
        }

        return
      }

      /* ---------------- planner ---------------- */

      case 'planner-start-generate': {
        this.state.currentPlannerId = data.plannerId

        this.state.planner.push({
          id: data.plannerId,
          plan: [],
        })

        return
      }

      case 'planner-step-generate': {
        const planner = getCurrentPlanner(this.state)
        if (!planner) return

        planner.plan.push(data.plan)
        return
      }

      case 'planner-execute-item-start': {
        const planner = getCurrentPlanner(this.state)
        if (!planner) return

        const step = planner.plan.find((s) => s.id === data.plan.id)
        if (step) step.status = 'running'

        return
      }

      case 'planner-execute-item-success': {
        const planner = getCurrentPlanner(this.state)
        if (!planner) return

        const step = planner.plan.find((s) => s.id === data.plan.id)
        if (step) step.status = 'completed'

        return
      }

      case 'planner-execute-item-error': {
        const planner = getCurrentPlanner(this.state)
        if (!planner) return

        const step = planner.plan.find((s) => s.id === data.plan.id)
        if (step) step.status = 'failed'

        return
      }
    }
  }
}

function getCurrentBlock(state: ThreadState) {
  return state.blocks.find((b) => b.id === state.currentBlockId)
}
function getCurrentPlanner(state: ThreadState) {
  return state.planner.find((b) => b.id === state.currentPlannerId)
}

function pushMessage(block: ConversationBlock, message: ThreadMessage) {
  block.messages.push(message)
}

function ensureLastMessage(block: ConversationBlock, role: ThreadMessage['role']) {
  const last = block.messages.at(-1)

  if (!last || last.role !== role) {
    const msg = {
      id: nanoid(),
      role,
      content: '',
    } as any

    block.messages.push(msg)

    return msg
  }

  return last
}