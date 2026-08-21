import type { AgentMessage } from '@vide/ai'
import matter from 'gray-matter'
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineTool, ToolProvider, type ToolRuntime } from '../toolProvider'
import { getSkillsRoot, getWorkspaceSkillsRoot, type WorkspacePath } from '../../workspace'
import { ToolCallError } from '../../error'

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

export const skillsPath = getSkillsRoot()

export class SkillTool extends ToolProvider {
  private workspacePath: string | null

  constructor(runtime: ToolRuntime) {
    super(runtime)
    this.workspacePath = runtime.workspacePath
  }

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
      // 确保当前 workspace 的 skills（全局内置 + 项目级）已扫描进 SkillsMap
      await scanSkills(this.workspacePath)
      const targetSkill = SkillsMap[name]
      if (!targetSkill) {
        throw new ToolCallError(`Skill "${name}" is not available.`)
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

/**
 * 扫描 skills：全局 ~/.vide/skills（内置 + 用户安装）始终扫描，
 * 若提供 workspacePath，则额外扫描 <workspace>/.vide/skills 下的项目级 skills，
 * 两者合并。同名 skill 时项目级覆盖全局。
 */
export async function scanSkills(
  workspacePath?: WorkspacePath
): Promise<(SkillMeta & { filePath: string })[]> {
  const roots = [getSkillsRoot(), getWorkspaceSkillsRoot(workspacePath)]
  const byName = new Map<string, SkillMeta & { filePath: string }>()

  for (const root of roots) {
    const skillsDirExists = await isDirectoryExists(root)
    if (!skillsDirExists) continue
    const dirs = await fs.readdir(root, { withFileTypes: true })

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue

      const skillFile = path.join(root, dir.name, 'SKILL.md')
      const meta = await readSkill(skillFile)

      if (meta) {
        byName.set(meta.name, { ...meta, filePath: skillFile })
      }
    }
  }

  return [...byName.values()]
}

export async function buildSkillsChatMessage(
  workspacePath?: WorkspacePath
): Promise<AgentMessage | null> {
  const skills = await scanSkills(workspacePath)
  if (skills.length === 0) return null

  const skillList = skills
    .map((skill) => {
      return `- ${skill.name}: ${skill.description}`
    })
    .join('\n')

  return {
    role: 'context',
    type: 'skills',
    content: `
You have access to the following skills.

${skillList}

If a user's request clearly matches a skill's purpose, prefer using that skill.
All necessary JavaScript and Python dependencies for the skills have been installed.
`.trim(),
  }
}
