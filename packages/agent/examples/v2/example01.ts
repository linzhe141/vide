import { Agent } from '../../src/v2/agent'
import type { WorkflowStream } from '../../src/v2/stream'
import { DevConfig } from '../dev.config'

async function main() {
  const agent = new Agent()

  const newSession = agent.createSession()

  newSession.setupModel({
    name: DevConfig.model.name,
    baseURL: DevConfig.model.baseURL,
    apiKey: DevConfig.model.apiKey,
  })

  const stream1 = newSession.prompt('你是谁？')
  await processStream(stream1)

  const stream2 = newSession.prompt('明天是什么日子放假吗？')
  await processStream(stream2)

  const stream3 = newSession.prompt('我现在一共问了几个问题了')
  await processStream(stream3)
}

main()

async function processStream(stream: WorkflowStream) {
  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'workflow.start':
        console.log('workflow.start')
        break
      case 'workflow.step.start':
        console.log('workflow.step.start', chunk.payload)
        break
      case 'workflow.llm.start':
        console.log('workflow.llm.start')
        break

      case 'workflow.llm.reason.start':
        console.log('workflow.llm.reason.start')
        break

      case 'workflow.llm.reason.delta':
        process.stdout.write(chunk.chunk.delta)
        break

      case 'workflow.llm.reason.end':
        console.log('\nworkflow.llm.reason.end')
        break

      case 'workflow.llm.text.start':
        console.log('\nworkflow.llm.text.start')
        break

      case 'workflow.llm.text.delta':
        process.stdout.write(chunk.chunk.delta)
        break
      case 'workflow.llm.text.end':
        console.log('\nworkflow.llm.text.end')
        break

      case 'workflow.llm.tool.call.process':
        console.log('\nworkflow.llm.tool.call.process', JSON.stringify(chunk))
        break
      case 'workflow.llm.tool.call.end':
        console.log('\nworkflow.llm.tool.call.end', JSON.stringify(chunk))
        break

      case 'workflow.llm.end':
        console.log('\nworkflow.llm.end')
        break
      case 'workflow.llm.result':
        console.log('\nworkflow.llm.result', JSON.stringify(chunk.result))
        break

      case 'workflow.tool.call.start':
        console.log('\nworkflow.tool.call.start', JSON.stringify(chunk))
        break
      case 'workflow.tool.call.success':
        console.log('\nworkflow.tool.call.success', JSON.stringify(chunk))
        break
      case 'workflow.tool.call.error':
        console.log('\nworkflow.tool.call.error', JSON.stringify(chunk))
        break

      case 'workflow.step.end':
        console.log('workflow.step.end')
        break
      case 'workflow.completed':
        console.log('workflow.completed')
        break
    }
  }
}
