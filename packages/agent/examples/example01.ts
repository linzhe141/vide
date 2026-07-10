import { DevConfig } from './dev.config'
import { Agent, createLLMClient } from '../src/index'
import process from 'node:process'
import path from 'node:path'

const pwd = path.resolve(process.cwd(), './packages/agent/examples')
async function main() {
  console.log('🚀 初始化 LLM 客户端...')
  createLLMClient({
    apiKey: DevConfig.llm.apiKey,
    baseURL: DevConfig.llm.baseURL,
    model: DevConfig.llm.model,
  })
  console.log('✅ LLM 客户端初始化完成\n')

  const agent = new Agent()
  console.log('🤖 创建 Agent 实例\n')

  const session = agent.createSession({
    sessionType: 'normal',
    autoApprove: true,
    workspacePath: pwd,
  })
  console.log(`📝 Session 创建完成 (ID: ${session.sessionId})\n`)

  // const userQuestion = '用 JavaScript 实现一个斐波那契数列函数'
  const userQuestion = '看下dev.config.ts的内容'
  console.log(`👤 用户提问: ${userQuestion}\n`)
  console.log('='.repeat(60))
  console.log('开始处理...\n')

  const stream = session.send(userQuestion)

  for await (const event of stream) {
    const eventName = event.eventName

    // 推理信息
    if (eventName === 'workflow-llm-reasoning-start') {
      console.log('\n💭 模型推理过程:')
    }

    if (eventName === 'workflow-llm-reasoning-delta') {
      const { delta } = event.data.chunk
      process.stdout.write(delta)
    }

    if (eventName === 'workflow-llm-reasoning-end') {
      console.log('\n✅ 推理完成\n')
    }

    // 文本响应
    if (eventName === 'workflow-llm-text-start') {
      console.log('📄 模型回复:')
    }

    if (eventName === 'workflow-llm-text-delta') {
      const { delta } = event.data.chunk
      process.stdout.write(delta)
    }

    if (eventName === 'workflow-llm-text-end') {
      console.log('\n✅ 回复完成\n')
    }

    // 工具调用
    if (eventName === 'workflow-llm-tool-calls-start') {
      console.log('\n🔧 模型准备调用工具')
    }

    if (eventName === 'workflow-llm-tool-call-name') {
      const { name } = event.data.data
      process.stdout.write(name)
    }

    if (eventName === 'workflow-llm-tool-call-arguments') {
      console.log(`  📋 参数: `)
      const { arguments: args } = event.data.data
      process.stdout.write(args)
    }

    // 工具执行
    if (eventName === 'workflow-tool-call-start') {
      const { toolName } = event.data.toolCall
      console.log(`\n⚙️  执行工具: ${toolName}`)
    }

    if (eventName === 'workflow-tool-call-success') {
      const { toolName, durationMs } = event.data.toolCallResult
      console.log(`✅ ${toolName} 执行成功 (耗时: ${durationMs}ms)`)
    }

    if (eventName === 'workflow-tool-call-error') {
      const { toolName, error } = event.data.toolCallResult
      console.log(`❌ ${toolName} 执行失败: ${error.message}`)
    }

    // 工作流状态
    if (eventName === 'workflow-start') {
      console.log('🔄 工作流开始')
    }

    if (eventName === 'workflow-finished') {
      console.log('\n🎉 工作流完成')
    }

    if (eventName === 'workflow-error') {
      const { error } = event.data
      console.log(`\n❌ 工作流错误: ${error.message}`)
    }

    if (eventName === 'workflow-aborted') {
      console.log('\n⚠️  工作流被中止')
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✨ 处理完成！')
}

main().catch((error) => {
  console.error('❌ 示例执行失败:', error)
  process.exit(1)
})
