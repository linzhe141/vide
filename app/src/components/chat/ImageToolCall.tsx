import { Clock3, XCircle, CheckCircle2, Download, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { Workflow } from '../../store/sessionStore/types'
import type { ToolCall } from '@/agent/core/types'

import { findToolResult } from './messages/ToolCallMessage'
import { CodeBlock } from '../codeblock'
function ImageToolCall({ workflow, toolCall }: { workflow: Workflow; toolCall: ToolCall }) {
  const [imageLoaded, setImageLoaded] = useState(false)

  const result = findToolResult(workflow, toolCall.id)
  const isRunning = !result
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)
  const imageUrl = result?.result?.url

  if (isRunning) {
    return (
      <div className='group border-primary/20 from-primary/5 relative overflow-hidden rounded-xl border bg-gradient-to-br to-transparent p-4'>
        <div className='via-primary/10 animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent to-transparent' />
        <div className='relative flex items-center gap-3'>
          <div className='bg-primary/10 rounded-full p-2'>
            <Sparkles className='text-primary h-4 w-4 animate-pulse' />
          </div>
          <div className='flex-1'>
            <p className='text-foreground text-sm font-medium'>Generating your image...</p>
            <p className='text-text-secondary mt-0.5 text-xs'>This may take a few seconds</p>
          </div>
          <div className='flex items-center gap-1.5'>
            <div className='bg-primary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]' />
            <div className='bg-primary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]' />
            <div className='bg-primary h-1.5 w-1.5 animate-bounce rounded-full' />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className='rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent p-4'>
        <div>
          <p className='flex items-center gap-1 text-sm font-semibold text-red-500'>
            <XCircle className='h-4 w-4 text-red-500' />
            Generation Failed
          </p>
          <p className='text-text-secondary mt-1 text-xs'>
            <CodeBlock
              code={JSON.stringify(
                result?.error instanceof Error ? result.error.message : result?.error,
                null,
                2
              )}
              lang='text'
            ></CodeBlock>
          </p>
        </div>
      </div>
    )
  }

  if (!imageUrl) return null

  return (
    <div className='group from-primary/5 border-primary/10 relative overflow-hidden rounded-xl border bg-gradient-to-br to-transparent'>
      <style>{styles}</style>
      {/* Image Container */}
      <div className='relative flex items-center justify-center'>
        {/* Loading skeleton */}
        {!imageLoaded && (
          <div className='bg-muted/20 absolute inset-0 flex items-center justify-center'>
            <div className='flex flex-col items-center gap-2'>
              <div className='border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent' />
              <p className='text-text-secondary text-xs'>Loading image...</p>
            </div>
          </div>
        )}

        {/* Actual Image */}
        <img
          src={imageUrl}
          alt='AI Generated Image'
          className={`w-1/2 transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
        />

        {/* Overlay Actions */}
        <div className='absolute inset-0 rounded-t-xl bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100'>
          <div className='absolute right-4 bottom-4 left-4 flex items-center justify-between gap-2'>
            <a
              href={imageUrl}
              className='flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-all hover:bg-white/20 disabled:opacity-50'
            >
              <Download className='h-3.5 w-3.5' />
              Download
            </a>

            {duration && (
              <div className='flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur-md'>
                <Clock3 className='h-3 w-3' />
                {duration}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className='border-primary/10 bg-background/50 flex items-center justify-between border-t px-4 py-3'>
        <div className='flex items-center gap-2'>
          <CheckCircle2 className='h-3.5 w-3.5 text-green-500' />
          <span className='text-text-secondary text-xs font-medium'>Generated successfully</span>
        </div>
        {duration && <span className='text-text-info text-xs'>{duration}</span>}
      </div>
    </div>
  )
}

// Helper function to format duration
function formatDuration(ms?: number): string | null {
  if (!ms) return null
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// Add animation keyframes to your global CSS or Tailwind config
const styles = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
`

export default ImageToolCall
