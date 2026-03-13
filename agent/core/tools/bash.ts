import type { Tool } from '@/agent/core/types'
import { spawn } from 'node:child_process'

export const BASH_NAMESPACE = 'BUILDIN_BASH_NAMESPACE'
export const BASH_TOOL_NAMES = {
  EXECUTE_BASH_COMMAND: `${BASH_NAMESPACE}_EXECUTE_BASH_COMMAND`,
} as const

export const bashTool: Tool = {
  name: BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND,
  type: 'function',
  function: {
    name: BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND,
    description:
      'Execute a bash command and return the output. Use this to run shell commands, scripts, or system operations.',
    parameters: {
      type: 'object',
      properties: {
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
        // cwd: {
        //   type: 'string',
        //   description: 'Working directory',
        // },
      },
    },
  },

  async executor(args: any = {}) {
    const { command, timeout = 30000 } = args

    return new Promise((resolve) => {
      const proc = spawn('bash', ['-c', command], {
        env: { ...process.env },
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false

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

        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? 0,
          timedOut,
        })
      })

      proc.on('error', (error) => {
        clearTimeout(timeoutId)

        resolve({
          stdout: '',
          stderr: `Error executing command: ${error.message}`,
          exitCode: 1,
          timedOut: false,
        })
      })
    })
  },
}
