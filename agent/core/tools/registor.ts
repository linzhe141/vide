import { getNormalizeTime } from './getNormalizeTime'
import { fileRead } from './fileRead'
import { fsWriteFile } from './fileWrite'
import { Artifact } from './artifact'
import { bashTool } from './bash'
import { Planner } from './planner'
import { AskUserQuestionTool } from './askUserQuestion'
import { SkillTool } from './skill'
import type { WorkflowRuntimeContext } from '../workflowRuntimeContext'
import type { Tool } from '../types'

export function registorTools(runtime: WorkflowRuntimeContext) {
  const planner = new Planner(runtime)
  const askUserQuestionTool = new AskUserQuestionTool(runtime)
  const skill = new SkillTool(runtime)
  const artifact = new Artifact(runtime)
  const tools: Tool[] = [
    getNormalizeTime,
    fileRead,
    fsWriteFile,
    bashTool,
    ...artifact.getTools(),
    ...planner.getTools(),
    ...askUserQuestionTool.getTools(),
    ...skill.getTools(),
  ]
  return tools
}
