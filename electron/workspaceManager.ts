import { app, dialog, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_VIDE_HOME,
  getArtifactsRoot,
  getSkillsRoot,
  getVideHome,
} from '@/agent/core/workspace'
import type { AppManager } from './appManager'

export type WorkspaceInfo = {
  workspacePath: string | null
  videHome: string
  artifactsPath: string
  skillsPath: string
}

export class WorkspaceManager {
  constructor(private app: AppManager) {}

  async init() {
    await this.ensureVideHome(null)
    await this.ensureBuiltinSkills()
  }

  getWorkspaceInfo(workspacePath: string | null = null): WorkspaceInfo {
    return {
      workspacePath,
      videHome: getVideHome(workspacePath),
      artifactsPath: getArtifactsRoot(workspacePath),
      skillsPath: getSkillsRoot(),
    }
  }

  async selectWorkspace() {
    const result = await dialog.showOpenDialog(this.app.windowManager.mainWindow, {
      title: 'Select workspace',
      defaultPath: app.getPath('home'),
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || !result.filePaths[0]) {
      return null
    }

    const workspacePath = result.filePaths[0]
    await this.ensureVideHome(workspacePath)
    return this.getWorkspaceInfo(workspacePath)
  }

  async ensureVideHome(workspacePath: string | null) {
    await fs.mkdir(getArtifactsRoot(workspacePath), { recursive: true })
    await fs.mkdir(getSkillsRoot(), { recursive: true })
  }

  async revealPath(targetPath: string) {
    const resolvedPath = path.resolve(targetPath)
    const stat = await fs.stat(resolvedPath)
    if (stat.isDirectory()) {
      await shell.openPath(resolvedPath)
      return
    }
    shell.showItemInFolder(resolvedPath)
  }

  private async ensureBuiltinSkills() {
    const builtinSkills = [
      {
        dir: 'writer',
        name: 'writer',
        description: 'Draft, revise, and polish long-form writing with clear structure.',
        content: [
          'Use this skill for reports, articles, specs, notes, and editing tasks.',
          '',
          '- Clarify the audience and purpose from the user request.',
          '- Create a concise outline before writing long documents.',
          '- Preserve user terminology and rewrite only when it improves clarity.',
        ],
      },
      {
        dir: 'research',
        name: 'research',
        description: 'Collect, compare, and synthesize information into actionable summaries.',
        content: [
          'Use this skill for research, comparison, investigation, and source synthesis tasks.',
          '',
          '- Separate confirmed facts from assumptions.',
          '- Prefer primary or official sources when available.',
          '- End with concise conclusions and next actions.',
        ],
      },
      {
        dir: 'planner',
        name: 'planner',
        description: 'Break ambiguous goals into sequenced plans and track execution.',
        content: [
          'Use this skill when a task has multiple phases, dependencies, or open-ended scope.',
          '',
          '- Identify milestones and dependencies.',
          '- Keep plans concrete and verifiable.',
          '- Update the plan as new constraints appear.',
        ],
      },
    ]

    for (const skill of builtinSkills) {
      const skillDir = path.join(getSkillsRoot(), skill.dir)
      const skillPath = path.join(skillDir, 'SKILL.md')
      try {
        await fs.access(skillPath)
        continue
      } catch {
        await fs.mkdir(skillDir, { recursive: true })
        await fs.writeFile(
          skillPath,
          `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.content.join('\n')}\n`,
          'utf8'
        )
      }
    }
  }
}

export { DEFAULT_VIDE_HOME }
