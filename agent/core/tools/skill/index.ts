import type { ChatMessage } from '../../types'
import matter from 'gray-matter'
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineTool, ToolProvider } from '../toolProvider'

async function isDirectoryExists(dirPath: string) {
  try {
    await fs.access(dirPath)
    return true
  } catch {
    return false
  }
}

export interface SkillMeta {
  name: string
  description: string
}
export const SKILL_TOOL_NAMES = {
  LOAD_SKILL: `load-skill`,
} as const

const SkillsMap: Record<
  string,
  {
    content: string
    filePath: string
  }
> = {}

export const skillsPath = '.vide/skills'

export class SkillTool extends ToolProvider {
  loadSkill = defineTool({
    name: SKILL_TOOL_NAMES.LOAD_SKILL,
    type: 'function',

    function: {
      name: SKILL_TOOL_NAMES.LOAD_SKILL,

      description: `Load a discovered Agent Skill by name.
Use this when a task matches an available skill description and you need the full skill instructions before proceeding.
`,

      parameters: {
        type: 'object',

        properties: {
          name: {
            type: 'string',
            description:
              'The skill name to load, exactly as shown in the available skills catalog.',
          },
        },

        required: ['name'],
      },
    },

    executor: async (args) => {
      const name = args.name.trim()
      const targetSkill = SkillsMap[name]
      if (!targetSkill) {
        return {
          reason: 'call-llm',
          result: `Skill "${name}" is not available`,
        }
      }
      return {
        reason: 'call-llm',
        result: {
          name,
          content: targetSkill.content,
          filePath: targetSkill.filePath,
        },
      }
    },
  })

  getTools() {
    return [this.loadSkill]
  }
}
async function readSkill(filePath: string): Promise<SkillMeta | null> {
  try {
    const skillContent = await fs.readFile(filePath, 'utf8')
    const { data, content } = matter(skillContent)

    if (!data?.name && !data?.description) return null
    SkillsMap[data.name] = {
      content,
      filePath,
    }
    return {
      name: data.name,
      description: data.description,
    }
  } catch {
    return null
  }
}

async function scanSkills(): Promise<SkillMeta[]> {
  const result: SkillMeta[] = []

  const skillsDirExists = await isDirectoryExists(skillsPath)
  if (!skillsDirExists) return []
  const dirs = await fs.readdir(skillsPath, { withFileTypes: true })

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue

    const skillFile = path.join(skillsPath, dir.name, 'SKILL.md')

    const meta = await readSkill(skillFile)

    if (meta) {
      result.push(meta)
    }
  }

  return result
}

export async function buildSkillsChatMessage(): Promise<ChatMessage | null> {
  const skills = await scanSkills()
  console.log('skills-->')
  console.log(Object.keys(SkillsMap))
  console.log()
  if (skills.length === 0) return null

  const skillList = skills
    .map((skill) => {
      return `- ${skill.name}: ${skill.description}`
    })
    .join('\n')

  return {
    role: 'user',
    content: `
You have access to the following skills.

${skillList}

If a user's request clearly matches a skill's purpose, prefer using that skill.
All necessary JavaScript and Python dependencies for the skills have been installed.
`.trim(),
  }
}
