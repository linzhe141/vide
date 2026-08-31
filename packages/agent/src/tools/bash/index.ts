import { defineTool, ToolProvider } from '../toolProvider'
import { spawn } from 'node:child_process'
import { DEFAULT_VIDE_HOME } from '../../workspace'
import { ToolCallError } from '../../error'

const MAX_CAPTURED_OUTPUT_CHARS = 64_000

type OutputBuffer = {
  text: string
  omittedChars: number
}

const getShellCommand = (command: string) => {
  if (process.platform === 'win32') {
    return {
      shell: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command', command],
    }
  }

  return {
    shell: 'bash',
    args: ['-c', command],
  }
}

export const BASH_TOOL_NAMES = {
  EXECUTE_BASH_COMMAND: `execute-bash-command`,
} as const

function appendOutput(buffer: OutputBuffer, chunk: string): OutputBuffer {
  const combined = buffer.text + chunk
  if (combined.length <= MAX_CAPTURED_OUTPUT_CHARS) {
    return {
      text: combined,
      omittedChars: buffer.omittedChars,
    }
  }

  const overflow = combined.length - MAX_CAPTURED_OUTPUT_CHARS
  return {
    text: combined.slice(-MAX_CAPTURED_OUTPUT_CHARS),
    omittedChars: buffer.omittedChars + overflow,
  }
}

function finalizeOutput(buffer: OutputBuffer): string {
  if (!buffer.omittedChars) {
    return buffer.text
  }

  return `...[truncated ${buffer.omittedChars} chars]\n${buffer.text}`
}

export class Bash extends ToolProvider {
  executeCommand = defineTool({
    name: BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND,
    type: 'function',
    function: {
      name: BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND,
      description: `Execute a shell command and return the output. On Windows this uses PowerShell, and on macOS/Linux it uses bash. Set background to true for long-running commands such as dev servers starting, installing packages etc.
for long-running commands, the command will be started in the background and the result will be returned immediately. you do not need to wait for the command to finish, 
and you can continue to use the agent while the command is running in the background.`,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
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
      const { shell, args: shellArgs } = getShellCommand(command)

      return new Promise((resolve, reject) => {
        const proc = spawn(shell, shellArgs, {
          env: { ...process.env },
          cwd: this.runtime.workspacePath || DEFAULT_VIDE_HOME,
          detached: !!background,
          windowsHide: true,
        })

        let stdout: OutputBuffer = { text: '', omittedChars: 0 }
        let stderr: OutputBuffer = { text: '', omittedChars: 0 }

        // signal

        // timeout handler
        const abortHandler = () => {
          proc.kill('SIGKILL')
          reject(new ToolCallError(`Command aborted`))
        }
        this.runtime.signal.addEventListener('abort', abortHandler, { once: true })
        const timeoutId = setTimeout(() => {
          proc.kill('SIGKILL')
          this.runtime.signal.removeEventListener('abort', abortHandler)
          reject(new ToolCallError(`Command timed out after ${timeout / 1000} seconds`))
        }, timeout)

        if (background) {
          clearTimeout(timeoutId)
          proc.unref()
          resolve({
            reason: 'call-llm',
            result: {
              content: `Command started in background`,
              stdout: '',
              stderr: '',
              exitCode: 0,
              background: true,
              pid: proc.pid,
            },
          })
          return
        }

        proc.stdout.on('data', (data) => {
          stdout = appendOutput(stdout, data.toString())
        })

        proc.stderr.on('data', (data) => {
          stderr = appendOutput(stderr, data.toString())
        })

        const successHandler = (exitCode: number | null) => {
          clearTimeout(timeoutId)
          this.runtime.signal.removeEventListener('abort', abortHandler)

          resolve({
            reason: 'call-llm',
            result: {
              stdout: finalizeOutput(stdout),
              stderr: finalizeOutput(stderr),
              stdoutTruncated: stdout.omittedChars > 0,
              stderrTruncated: stderr.omittedChars > 0,
              exitCode: exitCode ?? 0,
            },
          })
        }
        proc.on('close', successHandler)

        proc.on('error', (error) => {
          clearTimeout(timeoutId)
          proc.off('close', successHandler)
          this.runtime.signal.removeEventListener('abort', abortHandler)
          reject(new ToolCallError(`Error executing command: ${error.message}`))
        })
      })
    },
  })

  getTools() {
    return [this.executeCommand]
  }
}
