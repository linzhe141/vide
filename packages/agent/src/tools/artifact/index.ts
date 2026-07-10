import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { defineTool, ToolProvider } from '../toolProvider'
import { getArtifactsRoot } from '../../workspace'

export const ARTIFACT_TOOL_NAMES = {
  CREATE_WORKSPACE: `create-workspace`,
} as const

export class Artifact extends ToolProvider {
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

      const artifactDir = path.join(getArtifactsRoot(this.runtime.workspacePath), workspaceName)
      await fs.mkdir(artifactDir, { recursive: true })
      this.emit({
        eventName: 'artifacts-created-workspace',
        data: { workspaceName },
      })
      return {
        reason: 'call-llm',
        result: {
          artifactDir,
          message: `Artifact workspace created at ${artifactDir}. All generated files MUST be written inside this directory.`,
        },
      }
    },
  })

  getTools() {
    return [this.createWorkspace]
  }
}
