import { Agent } from './core/agent'
import { onAgentEvent, onPalnnervent, onWorkflowEvent } from './core/apiEvent'
import chalk from 'chalk'
import ora from 'ora'

const divider = () => console.log(chalk.gray('─'.repeat(process.stdout.columns || 50)))

const title = (text: string) => console.log('\n' + chalk.cyan.bold(`▶ ${text}`))

async function main() {
  console.clear()
  setupEvents()
  const agent = new Agent()
  const session = agent.createSession()
  await session.run(
    'hello! who are you ?, 明天是什么日期是多少,ps :使用小红书风格回复 output japanese'
  )
}

function setupEvents() {
  let spinner: any

  // ================= AGENT =================
  onAgentEvent('agent-create-session', (data) => {
    divider()
    title('SESSION')
    console.log(chalk.green(`✔ Session: ${data.sessionId}`))
  })

  onAgentEvent('agent-session-start-analyze-input', ({ userInput }) => {
    title('ANALYZE INPUT:' + userInput)
    spinner = ora('Analyzing input...').start()
  })

  onAgentEvent('agent-session-end-analyze-input', (data) => {
    spinner?.succeed('Analyze complete')
    console.log(chalk.yellow(`Mode: ${data.mode}`))
  })

  // ================= PLANNER =================
  onPalnnervent('planner-start-generate', () => {
    title('PLANNER')
    spinner = ora('Generating plan...').start()
  })

  onPalnnervent('planner-end-generate', (data) => {
    spinner?.succeed('Plan generated')

    data.plans.forEach((plan: any, index: number) => {
      console.log(chalk.gray(`  ${index + 1}. ${plan.description}`))
    })
  })

  onPalnnervent('planner-execute-item-start', (data) => {
    spinner = ora(`Executing: ${data.plan.description}`).start()
  })

  onPalnnervent('planner-execute-item-success', () => {
    spinner?.succeed('Step done')
  })

  onPalnnervent('planner-execute-item-error', () => {
    spinner?.fail('Step failed')
  })

  // ================= WORKFLOW =================
  onWorkflowEvent('workflow-start', () => {
    title('WORKFLOW')
  })

  onWorkflowEvent('workflow-llm-start', () => {
    spinner = ora('LLM thinking...').start()
  })

  onWorkflowEvent('workflow-llm-text-start', () => {
    spinner?.stop()
    console.log('\n' + chalk.greenBright('✨ AI Response:\n'))
  })

  onWorkflowEvent('workflow-llm-text-delta', ({ chunk }) => {
    process.stdout.write(chalk.white(chunk.delta))
  })

  onWorkflowEvent('workflow-llm-text-end', () => {
    console.log('\n')
  })

  onWorkflowEvent('workflow-llm-tool-calls', ({ toolCalls }) => {
    console.log(chalk.blue('\n🔧 Tool Calls:\n' + JSON.stringify(toolCalls, null, 2)))
  })

  onWorkflowEvent('workflow-llm-end', () => {
    console.log(chalk.gray('\nLLM finished'))
  })

  onWorkflowEvent('workflow-tool-call-start', ({ toolCall }) => {
    console.log(chalk.cyan(`\n→ Tool: ${toolCall.toolName}`))
  })

  onWorkflowEvent('workflow-tool-call-success', (data) => {
    console.log(chalk.green('  ✔ Tool success'))
    console.log(chalk.green(JSON.stringify(data.toolCallResult, null, 2)))
  })

  onWorkflowEvent('workflow-tool-call-error', () => {
    console.log(chalk.red('  ✖ Tool error'))
  })

  onWorkflowEvent('workflow-finished', () => {
    divider()
    console.log(chalk.green.bold('✅ Workflow Finished'))
    divider()
  })
}

main()
