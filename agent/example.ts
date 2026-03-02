import { Agent } from './core/agent'

async function main() {
  const agent = new Agent()
  const session = agent.createSession()
  await session.run('明天是什么日子')
  console.log(session.workflowBlocks.map((i) => JSON.stringify(i.thread.ctx.messages, null, 2)))
}

main()
