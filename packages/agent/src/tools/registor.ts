import { Read } from './fileRead'
import { Time } from './time'
import { Write } from './write'
import { Edit } from './edit'
import { Artifact } from './artifact'
import { Bash } from './bash'
import { Grep } from './grep'
import { AskUserQuestionTool } from './askUserQuestion'
import { Image } from './image'
import { WebSearch } from './websearch'
import type { Tool } from '@vide/ai'
import type { WorkflowRuntimeContext } from '../workflow'
import { CallSubAgent } from './callSubAgent'

export function registorTools(runtime: WorkflowRuntimeContext) {
  const timer = new Time(runtime)
  const write = new Write(runtime)
  const edit = new Edit(runtime)
  const artifact = new Artifact(runtime)
  const bash = new Bash(runtime)
  const grep = new Grep(runtime)
  const askUserQuestionTool = new AskUserQuestionTool(runtime)
  const read = new Read(runtime)
  const webSearch = new WebSearch(runtime)
  const callSubAgent = new CallSubAgent(runtime)
  const tools: Tool[] = [
    ...read.getTools(),
    ...timer.getTools(),
    ...write.getTools(),
    ...edit.getTools(),
    ...artifact.getTools(),
    ...bash.getTools(),
    // ...planner.getTools(),
    ...grep.getTools(),
    ...webSearch.getTools(),
    ...askUserQuestionTool.getTools(),
    // ...skill.getTools(),
    ...callSubAgent.getTools(),
    ...new Image(runtime).getTools(),
  ]
  return tools
}
