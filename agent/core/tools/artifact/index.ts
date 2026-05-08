import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { artifactEvent } from '../../event'
import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'
import { defineTool, ToolProvider } from '../toolProvider'

const ARTIFACT_ROOT = '.vide/artifacts'

export const ARTIFACT_NAMESPACE = 'BUILDIN_ARTIFACT_NAMESPACE'
export const ARTIFACT_TOOL_NAMES = {
  CREATE_WORKSPACE: `${ARTIFACT_NAMESPACE}_CREATE_WORKSPACE`,
} as const

export class Artifact extends ToolProvider {
  constructor(runtime: WorkflowRuntimeContext) {
    super(runtime)
  }

  createWorkspace = defineTool({
    name: ARTIFACT_TOOL_NAMES.CREATE_WORKSPACE,
    type: 'function',
    function: {
      name: ARTIFACT_TOOL_NAMES.CREATE_WORKSPACE,
      description: `
Create a workspace directory for generated artifacts.

Use this tool when the task requires generating files such as:
- reports
- presentations
- markdown documents
- json outputs
- diagrams
- datasets

The tool will return a unique artifact directory.

⚠️ IMPORTANT:
All generated files MUST be written inside the returned artifactDir.
`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the artifact workspace (e.g. report, slides, dataset)',
          },
        },
        required: ['name'],
      },
    },

    executor: async (args: any = {}) => {
      const { name } = args

      const uuid = randomUUID().slice(0, 8)

      const workspaceName = `${name}-${uuid}`

      const artifactDir = path.join(ARTIFACT_ROOT, workspaceName)
      await fs.mkdir(artifactDir, { recursive: true })
      artifactEvent.emit('artifacts-created-workspace', {
        sessionId: this.runtime.sessionId,
        workspaceName,
      })
      return {
        reason: 'call-llm',
        result: {
          success: true,
          artifactDir,
          workspaceId: uuid,
          message: `Artifact workspace created at ${artifactDir}. All generated files MUST be written inside this directory.`,
        },
      }
    },
  })

  getTools() {
    return [this.createWorkspace]
  }
}
