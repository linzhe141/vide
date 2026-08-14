import { ToolCallError } from '../../error'
import { defineTool, ToolProvider } from '../toolProvider'

export const TODO_TOOL_NAMES = {
  WRITE: 'todo_write',
} as const

/** The valid statuses */
const STATUSES = ['pending', 'in_progress', 'completed'] as const

const DESCRIPTION =
  'Record and update a structured task list for the current work. Send the ENTIRE ' +
  'list every call — it REPLACES the previous list (there are no partial updates, ' +
  'no per-item edits). Use it to plan multi-step work and show progress: add one ' +
  'todo per concrete step before you start. ' +
  'Keep AT MOST ONE todo `in_progress` at a time; while work remains, exactly one ' +
  'active task should be `in_progress`. ' +
  'Mark a todo `completed` the moment it is done (do not batch completions), and ' +
  'allow no `in_progress` item only once all work is complete. Skip the list for ' +
  'trivial single-step tasks. Statuses: `pending` (not started), `in_progress` ' +
  '(being worked on now), `completed` (finished).'

function toTodoList(
  raw: { content: string; status: string }[]
): { content: string; status: 'pending' | 'in_progress' | 'completed' }[] {
  const todos: { content: string; status: 'pending' | 'in_progress' | 'completed' }[] = []
  const seen = new Set<string>()
  let active = 0

  for (const item of raw) {
    const content = item.content.trim()
    if (content.length === 0) {
      throw new ToolCallError('invalid todo: `content` must be a non-empty string')
    }
    if (seen.has(content)) {
      throw new ToolCallError(`invalid todos: duplicate content ${JSON.stringify(content)}`)
    }
    seen.add(content)

    if (!STATUSES.includes(item.status as any)) {
      throw new ToolCallError(`invalid todo: status must be one of ${STATUSES.join(', ')}`)
    }

    if (item.status === 'in_progress') active++
    todos.push({ content, status: item.status as any })
  }

  if (active > 1) {
    throw new ToolCallError(`invalid todos: at most one task may be in_progress (got ${active})`)
  }

  return todos
}

export class Todo extends ToolProvider {
  write = defineTool({
    name: TODO_TOOL_NAMES.WRITE,
    type: 'function',
    function: {
      name: TODO_TOOL_NAMES.WRITE,
      description: DESCRIPTION,
      parameters: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: 'The COMPLETE task list, replacing any previous list.',
            items: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'What the task is — a short imperative line.',
                },
                status: {
                  type: 'string',
                  enum: [...STATUSES],
                  description: 'pending (not started) | in_progress (now) | completed (done).',
                },
              },
              required: ['content', 'status'],
              additionalProperties: false,
            },
          },
        },
        required: ['todos'],
      },
    },
    async executor(args: any = {}) {
      const todos = toTodoList(args.todos)

      const count = (status: string): number => todos.filter((t) => t.status === status).length

      return {
        reason: 'call-llm',
        result: {
          todos: todos.map((todo) => ({ content: todo.content, status: todo.status })),
          counts: {
            pending: count('pending'),
            inProgress: count('in_progress'),
            completed: count('completed'),
          },
        },
      }
    },
  })

  getTools() {
    return [this.write]
  }
}
