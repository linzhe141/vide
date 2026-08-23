import { AskUserQuestionTool } from './askUserQuestion'
import { CallSubAgent } from './callSubAgent'
import { Time } from './time'
import { WebSearch } from './websearch'
import { Edit } from './edit'
import { Write } from './write'
import { Read } from './fileRead'
import { Bash } from './bash'
import { Todo } from './todo'
import { Grep } from './grep'
import { SkillTool } from './skill'
import { Image } from './image'
import type { WorkflowRuntimeContext } from '../workflow'

export function getBuildInTools(toolRuntime: WorkflowRuntimeContext) {
  return [
    ...new Time(toolRuntime).getTools(),
    ...new WebSearch(toolRuntime).getTools(),
    ...new Image(toolRuntime).getTools(),
    ...new AskUserQuestionTool(toolRuntime).getTools(),
    ...new Edit(toolRuntime).getTools(),
    ...new Write(toolRuntime).getTools(),
    ...new Read(toolRuntime).getTools(),
    ...new Bash(toolRuntime).getTools(),
    ...new Todo(toolRuntime).getTools(),
    ...new Grep(toolRuntime).getTools(),
    ...new SkillTool(toolRuntime).getTools(),
    ...new CallSubAgent(toolRuntime).getTools(),
  ]
}
