import { useState } from 'react'
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { useChatContext } from '@/hooks/useChatContext'
import { useSession, useSessionStoreActions, useWorkflowBranches } from '../../store/sessionStore'
import { type Workflow } from '../../store/sessionStore/types'
import { Textarea } from '../../ui/Textarea'
import { Button } from '@/ui/Button'

export function SessionActions({ workflow }: { workflow: Workflow }) {
  const { handleRegenerate, sessionId } = useChatContext()
  const { setWorkflowFeedback } = useSessionStoreActions()
  const [memoryQueued, setMemoryQueued] = useState(false)
  const [dislikeOpen, setDislikeOpen] = useState(false)
  const [dislikeReason, setDislikeReason] = useState('')

  function onClickRegenerate() {
    const regenerateBranchName = createBranchPayload({
      type: 'regenerate',
      branchName: `regenerate-${Date.now()}`,
      workflowId: workflow.id,
    })
    handleRegenerate(workflow.id, regenerateBranchName, workflow.input)
  }

  function submitUserMemoryFeedback(rating: 'manual' | 'like' | 'dislike', reason?: string) {
    setMemoryQueued(true)
    window.setTimeout(() => setMemoryQueued(false), 1600)

    if (rating === 'like' || rating === 'dislike') {
      setWorkflowFeedback({ sessionId, workflowId: workflow.id, feedback: rating })
    }
    setDislikeOpen(false)
    setDislikeReason('')

    window.ipcRendererApi
      .invoke('agent-update-user-memory', {
        sessionId,
        workflowId: workflow.id,
        feedback: {
          rating,
          reason: reason?.trim() || undefined,
        },
      })
      .catch((error) => {
        console.error('Failed to update user memory:', error)
      })
  }

  const liked = workflow.feedback === 'like'
  const disliked = workflow.feedback === 'dislike'

  return (
    <div className='space-y-3'>
      <div className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <button
            type='button'
            onClick={onClickRegenerate}
            className='border-primary/20 bg-primary/10 text-foreground hover:bg-primary/14 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition'
          >
            <RefreshCcw size={13} />
            Regenerate
          </button>

          <button
            type='button'
            onClick={() => submitUserMemoryFeedback('manual')}
            className='border-foreground/10 bg-foreground/3 hover:bg-foreground/6 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60'
          >
            <Brain size={13} />
            {memoryQueued ? 'Queued' : 'Extract memory'}
          </button>

          <button
            type='button'
            onClick={() => submitUserMemoryFeedback('like')}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              liked
                ? 'border-primary/30 bg-primary/15 text-primary'
                : 'border-foreground/10 bg-foreground/3 hover:bg-foreground/6'
            }`}
          >
            <ThumbsUp size={13} />
          </button>

          <button
            type='button'
            onClick={() => setDislikeOpen((open) => !open)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              disliked
                ? 'border-red-500/30 bg-red-500/10 text-red-500'
                : 'border-foreground/10 bg-foreground/3 hover:bg-foreground/6'
            }`}
          >
            <ThumbsDown size={13} />
          </button>
        </div>
        {dislikeOpen && (
          <div className='border-foreground/10 bg-foreground/3 max-w-2xl space-y-2 rounded-xl border p-3'>
            <Textarea
              value={dislikeReason}
              onChange={(event) => setDislikeReason(event.target.value)}
              placeholder='What should be remembered about this response?'
              className='min-h-18 resize-none'
            />
            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                onClick={() => {
                  setDislikeOpen(false)
                  setDislikeReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                type='button'
                onClick={() => submitUserMemoryFeedback('dislike', dislikeReason)}
              >
                Save feedback
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function RegeneratedBranchSwitcher({ workflow }: { workflow: Workflow }) {
  const { sessionId } = useChatContext()
  const session = useSession(sessionId)
  const { switchBranch } = useSessionStoreActions()
  const parentNodeId = session?.workflowNodesMap[workflow.id].parent ?? null
  const branchOptions = useWorkflowBranches(sessionId, parentNodeId)
  if (!session || branchOptions.length <= 1) return null

  const siblingVariants = getSiblingVariants(branchOptions, parentNodeId)
  const currentVariantIndex = siblingVariants.findIndex((option) => {
    return getDirectChildId(option.path, parentNodeId) === workflow.id
  })

  function switchVariant(direction: number) {
    if (currentVariantIndex === -1) return
    const nextIndex =
      (currentVariantIndex + direction + siblingVariants.length) % siblingVariants.length
    const nextBranch = siblingVariants[nextIndex]
    switchBranch(session!.sessionId, nextBranch.name)
  }

  return (
    <div className='space-y-3'>
      <div className='border-foreground/10 from-foreground/3 to-primary/8 rounded-2xl border bg-linear-to-r via-transparent px-3 py-2.5'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='bg-primary/12 text-primary flex h-8 w-8 items-center justify-center rounded-full'>
              <Sparkles size={14} />
            </div>
            <div className='min-w-0'>
              <div className='text-foreground text-sm font-medium'>Response variants</div>
              <div className='text-text-info text-xs'>
                {currentVariantIndex + 1} of {siblingVariants.length}
              </div>
            </div>
          </div>

          <div className='flex items-center gap-1.5'>
            <button
              type='button'
              onClick={() => switchVariant(-1)}
              className='hover:bg-foreground/8 border-foreground/10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition'
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type='button'
              onClick={() => switchVariant(1)}
              className='hover:bg-foreground/8 border-foreground/10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition'
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function createBranchPayload(payload: {
  branchName: string
  workflowId: string
  type: 'regenerate'
}) {
  return JSON.stringify(payload)
}

function getSiblingVariants<
  T extends {
    name: string
    path: string[]
  },
>(branchOptions: T[], parentNodeId: string | null) {
  const variantsByChildId = new Map<string, T>()

  for (const option of branchOptions) {
    if (!isRegenerateVariant(option.name)) continue

    const childId = getDirectChildId(option.path, parentNodeId)
    if (!childId) continue

    const existingOption = variantsByChildId.get(childId)
    if (!existingOption) {
      variantsByChildId.set(childId, option)
      continue
    }

    if (option.path.length < existingOption.path.length) {
      variantsByChildId.set(childId, option)
    }
  }

  return [...variantsByChildId.values()]
}

function isRegenerateVariant(branchName: string) {
  if (branchName === 'main') return true

  try {
    const payload = JSON.parse(branchName)
    return payload.type === 'regenerate'
  } catch (_e) {
    return false
  }
}

function getDirectChildId(path: string[], parentNodeId: string | null) {
  if (!path.length) return null
  if (!parentNodeId) return path[0] ?? null

  const parentIndex = path.indexOf(parentNodeId)
  if (parentIndex === -1) return null

  return path[parentIndex + 1] ?? null
}
