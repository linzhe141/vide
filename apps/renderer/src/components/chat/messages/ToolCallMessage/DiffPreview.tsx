type DiffPreviewProps = {
  diff: string
}

type DiffLine = {
  kind: 'file' | 'hunk' | 'add' | 'remove' | 'context'
  content: string
  oldLine: number | null
  newLine: number | null
}

export function DiffPreview({ diff }: DiffPreviewProps) {
  const lines = parseUnifiedDiff(diff)

  return (
    <div className='border-border/80 overflow-hidden rounded-2xl border'>
      <div className='border-border bg-foreground/[0.03] text-text-secondary px-3 py-2 text-[11px] font-medium tracking-[0.12em] uppercase'>
        Diff Preview
      </div>
      <div className='bg-background overflow-auto font-mono text-xs leading-6'>
        {lines.map((line, index) => (
          <div
            key={`${index}-${line.content}`}
            className={[
              'grid min-w-full grid-cols-[3.5rem_3.5rem_minmax(0,1fr)]',
              line.kind === 'add' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              line.kind === 'remove' && 'bg-red-500/10 text-red-600 dark:text-red-300',
              line.kind === 'hunk' && 'bg-primary/10 text-primary',
              line.kind === 'file' && 'bg-foreground/[0.04] text-text-info',
              line.kind === 'context' && 'text-foreground',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className='border-r border-white/6 px-3 text-right text-[11px] opacity-60'>
              {line.oldLine ?? ''}
            </span>
            <span className='border-r border-white/6 px-3 text-right text-[11px] opacity-60'>
              {line.newLine ?? ''}
            </span>
            <pre className='overflow-x-auto px-3 whitespace-pre-wrap'>{line.content || ' '}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

function parseUnifiedDiff(diff: string): DiffLine[] {
  const sourceLines = diff.split(/\r?\n/)
  const result: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const rawLine of sourceLines) {
    if (rawLine.startsWith('---') || rawLine.startsWith('+++')) {
      result.push({ kind: 'file', content: rawLine, oldLine: null, newLine: null })
      continue
    }

    if (rawLine.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(rawLine)
      if (match) {
        oldLine = Number(match[1])
        newLine = Number(match[2])
      }
      result.push({ kind: 'hunk', content: rawLine, oldLine: null, newLine: null })
      continue
    }

    if (rawLine.startsWith('+')) {
      result.push({ kind: 'add', content: rawLine, oldLine: null, newLine })
      newLine += 1
      continue
    }

    if (rawLine.startsWith('-')) {
      result.push({ kind: 'remove', content: rawLine, oldLine, newLine: null })
      oldLine += 1
      continue
    }

    if (rawLine.startsWith('\\')) {
      result.push({ kind: 'file', content: rawLine, oldLine: null, newLine: null })
      continue
    }

    result.push({ kind: 'context', content: rawLine, oldLine, newLine })
    oldLine += 1
    newLine += 1
  }

  return result
}
