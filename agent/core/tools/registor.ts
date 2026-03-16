import { getNormalizeTime } from './getNormalizeTime'
import { fileRead } from './fileRead'
import { fsWriteFile } from './fileWrite'
import { artifactTool } from './artifact'
import { bashTool } from './bash'
import { Planner } from './planner'
import { AskUserQuestionTool } from './askUserQuestion'
import { SkillTool } from './skill'
import type { WorkflowRuntimeContext } from '../workflowRuntimeContext'
import type { Tool } from '../types'

export function registorTools(runtime: WorkflowRuntimeContext) {
  const planner = new Planner(runtime)
  const askUserQuestionTool = new AskUserQuestionTool(runtime)
  const skillTool = new SkillTool(runtime)

  const tools: Tool[] = [
    getNormalizeTime,
    fileRead,
    fsWriteFile,
    bashTool,
    artifactTool,
    ...planner.getTools(),
    ...askUserQuestionTool.getTools(),
    ...skillTool.getTools(),
  ]
  return tools
}
