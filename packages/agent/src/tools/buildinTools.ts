import type { ToolRuntime } from './toolProvider'
import { AskUserQuestionTool } from './askUserQuestion'
import { Time } from './time'
import { WebSearch } from './websearch'
import { Edit } from './edit'
import { Write } from './write'
import { Read } from './fileRead'
import { Bash } from './bash'

export function getBuildInTools(toolRuntime: ToolRuntime) {
  return [
    ...new Time(toolRuntime).getTools(),
    ...new WebSearch(toolRuntime).getTools(),
    ...new AskUserQuestionTool(toolRuntime).getTools(),
    ...new Edit(toolRuntime).getTools(),
    ...new Write(toolRuntime).getTools(),
    ...new Read(toolRuntime).getTools(),
    ...new Bash(toolRuntime).getTools(),
  ]
}
