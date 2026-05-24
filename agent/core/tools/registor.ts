import { fileRead } from './fileRead'
import { Time } from './time'
import { Write } from './write'
import { Edit } from './edit'
import { Artifact } from './artifact'
import { Bash } from './bash'
import { Planner } from './planner'
import { Grep } from './grep'
import { AskUserQuestionTool } from './askUserQuestion'
import { SkillTool } from './skill'
import { Image } from './image'
import type { Tool } from '../types'
import type { WorkflowRuntimeContext } from '../workflow'

export function registorTools(runtime: WorkflowRuntimeContext) {
  const timer = new Time(runtime)
  const write = new Write(runtime)
  const edit = new Edit(runtime)
  const artifact = new Artifact(runtime)
  const bash = new Bash(runtime)
  const planner = new Planner(runtime)
  const grep = new Grep(runtime)
  const askUserQuestionTool = new AskUserQuestionTool(runtime)
  const skill = new SkillTool(runtime)
  const tools: Tool[] = [
    fileRead,
    ...timer.getTools(),
    ...write.getTools(),
    ...edit.getTools(),
    ...artifact.getTools(),
    ...bash.getTools(),
    ...planner.getTools(),
    ...grep.getTools(),
    ...askUserQuestionTool.getTools(),
    ...skill.getTools(),
    ...new Image(runtime).getTools(),
  ]
  return tools
}
