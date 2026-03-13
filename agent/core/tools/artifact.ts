import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Tool } from '@/agent/core/types'

const ARTIFACT_ROOT = '.vide/artifacts'

export const artifactTool: Tool = {
  name: 'create_artifact_workspace',
  type: 'function',
  function: {
    name: 'create_artifact_workspace',
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

  async executor(args: any = {}) {
    const { name } = args

    const uuid = randomUUID().slice(0, 8)

    const dirName = `${name}-${uuid}`

    const artifactDir = path.join(ARTIFACT_ROOT, dirName)

    await fs.mkdir(artifactDir, { recursive: true })

    return {
      success: true,
      artifactDir,
      workspaceId: uuid,
      message: `Artifact workspace created at ${artifactDir}. All generated files MUST be written inside this directory.`,
    }
  },
}
