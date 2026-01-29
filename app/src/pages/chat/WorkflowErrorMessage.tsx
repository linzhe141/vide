import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'

export function WorkflowErrorMessage({ error }: { error: any }) {
  return (
    <div className='group rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-red-600 dark:text-red-400'>
      {/* Header */}
      <div className='mb-2 flex items-center gap-2 text-xs font-medium'>
        <span className='inline-flex size-2 rounded-full bg-red-500' />
        <span>Error occurred</span>
      </div>

      {/* Content */}
      <div>
        <MarkdownRenderer animation={false}>
          {'```text\n' + String(error) + '\n```'}
        </MarkdownRenderer>
      </div>
    </div>
  )
}
