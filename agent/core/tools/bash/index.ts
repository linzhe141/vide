import { defineTool, ToolProvider } from '../toolProvider'
import { spawn } from 'node:child_process'
import { DEFAULT_VIDE_HOME } from '../../workspace'

export const BASH_TOOL_NAMES = {
  EXECUTE_BASH_COMMAND: `execute-bash-command`,
} as const

export class Bash extends ToolProvider {
  executeCommand = defineTool({
    name: BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND,
    type: 'function',
    function: {
      name: BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND,
      description:
        'Execute a bash command and return the output. Set background to true for long-running commands such as dev servers.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The bash command to execute',
          },
          background: {
            type: 'boolean',
            description:
              'Start the command in the background and return immediately. Use for long-running processes such as vite dev or npm dev.',
          },
          // cwd: {
          //   type: 'string',
          //   description: 'Working directory',
          // },
        },
        required: ['command'],
      },
    },
    approval: {
      required: true,
      summary: (args) => args?.command || 'Run bash command',
    },

    executor: async (args: any = {}) => {
      const { command, background = false } = args
      const timeout = 30000
      return new Promise((resolve) => {
        const proc = spawn('bash', ['-c', command], {
          env: { ...process.env },
          cwd: this.runtime.workspacePath || DEFAULT_VIDE_HOME,
          detached: !!background,
        })

        let stdout = ''
        let stderr = ''
        let timedOut = false
        this.runtime.setAbortHandler(() => {
          proc.kill('SIGKILL')
        })

        if (background) {
          proc.unref()
          this.runtime.setAbortHandler(null)
          resolve({
            reason: 'call-llm',
            result: {
              stdout: '',
              stderr: '',
              exitCode: 0,
              timedOut: false,
              background: true,
              pid: proc.pid,
            },
          })
          return
        }

        const timeoutId = setTimeout(() => {
          timedOut = true
          proc.kill('SIGKILL')
        }, timeout)

        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        proc.on('close', (exitCode) => {
          clearTimeout(timeoutId)
          this.runtime.setAbortHandler(null)

          resolve({
            reason: 'call-llm',
            result: {
              stdout,
              stderr,
              exitCode: exitCode ?? 0,
              timedOut,
            },
          })
        })

        proc.on('error', (error) => {
          clearTimeout(timeoutId)
          this.runtime.setAbortHandler(null)
          resolve({
            reason: 'call-llm',
            result: {
              stdout: '',
              stderr: `Error executing command: ${error.message}`,
              exitCode: 1,
              timedOut: false,
            },
          })
        })
      })
    },
  })

  getTools() {
    return [this.executeCommand]
  }
}
