import { defineTool, ToolProvider } from '../toolProvider'
import { spawn } from 'node:child_process'
import { DEFAULT_VIDE_HOME } from '../../workspace'
import { ToolCallError } from '../../error'

export const GREP_TOOL_NAMES = {
  SEARCH: `rg-content-search`,
} as const

export class Grep extends ToolProvider {
  search = defineTool({
    name: GREP_TOOL_NAMES.SEARCH,
    type: 'function',
    function: {
      name: GREP_TOOL_NAMES.SEARCH,
      description:
        'Search text in files using ripgrep. Returns matching lines with file paths and line numbers.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Search pattern (regex or plain text)',
          },
          path: {
            type: 'string',
            description: 'Directory or file to search (default: current directory)',
          },
          glob: {
            type: 'string',
            description: "Filter files (e.g. '*.ts', '**/*.test.ts')",
          },
          ignoreCase: {
            type: 'boolean',
            description: 'Case-insensitive search',
          },
          literal: {
            type: 'boolean',
            description: 'Treat pattern as plain text (not regex)',
          },
          context: {
            type: 'number',
            description: 'Lines of context around match',
          },
          limit: {
            type: 'number',
            description: 'Max number of matches (default: 100)',
          },
        },
        required: ['pattern'],
      },
    },

    executor: async (args: any = {}) => {
      const { pattern, path = '.', glob, ignoreCase, literal, context, limit = 100 } = args

      return new Promise((resolve, reject) => {
        const rgArgs: string[] = ['--line-number', '--color=never', '--max-count', String(limit)]

        if (ignoreCase) rgArgs.push('-i')
        if (literal) rgArgs.push('-F')
        if (context) rgArgs.push('-C', String(context))
        if (glob) rgArgs.push('--glob', glob)

        rgArgs.push(pattern, path)

        const proc = spawn('rg', rgArgs, {
          env: { ...process.env },
          cwd: this.runtime.workspacePath || DEFAULT_VIDE_HOME,
        })

        let stdout = ''
        const MAX_OUTPUT = 2000 // 防止炸 token

        proc.stdout.on('data', (data) => {
          if (stdout.length < MAX_OUTPUT) {
            stdout += data.toString()
          }
        })

        const successHandler = (exitCode: number | null) => {
          const output = stdout
          if (!output.trim()) {
            resolve({
              reason: 'call-llm',
              result: {
                output: 'No matches found',
                exitCode: exitCode ?? 0,
              },
            })
            return
          }

          resolve({
            reason: 'call-llm',
            result: {
              output,
              exitCode: exitCode ?? 0,
            },
          })
        }
        proc.on('close', successHandler)
        proc.on('error', (error) => {
          proc.off('close', successHandler)
          reject(
            new ToolCallError(
              `Failed to execute grep: ${error instanceof Error ? error.message : String(error)}`
            )
          )
        })
      })
    },
  })

  getTools() {
    return [this.search]
  }
}
