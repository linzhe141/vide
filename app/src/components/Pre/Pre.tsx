import { memo, useEffect, useRef, useState, type PropsWithChildren, type ReactElement } from 'react'
import { cn } from '../../lib/utils'
import { THEME } from '../highlight/codeTheme'
import type { ThemedToken } from 'shiki'
import { highlighter, defaultLangs, FALLBACK_LANG } from '../highlight/shiki'
import { ShikiStreamTokenizer } from 'shiki-stream'
import { Copy, Check } from 'lucide-react'

export const Pre = memo(function Pre(props: PropsWithChildren) {
  const codeElement = props.children as ReactElement<PropsWithChildren>
  const code = codeElement.props.children
  const language = getCodeLanguage(codeElement)
  const formatLang = language as keyof typeof defaultLangs
  if (code) {
    return (
      <StreamBlock
        code={String(code)}
        lang={defaultLangs[formatLang] !== undefined ? formatLang : FALLBACK_LANG}
      ></StreamBlock>
    )
  }
  return null
})

const StreamBlock = memo(function StreamBlock({ code, lang }: { code: string; lang: string }) {
  const indexRef = useRef(0)
  const [tokens, setTokens] = useState<ThemedToken[]>([])
  const tokenizerRef = useRef<ShikiStreamTokenizer>(
    new ShikiStreamTokenizer({
      highlighter: highlighter!,
      lang: lang,
      theme: 'css-variables',
    })
  )

  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  useEffect(() => {
    async function updateStreamTokens() {
      let formatCode = code
      if (code.at(-1) === '\n') formatCode = code.slice(0, -1)
      if (formatCode.length > indexRef.current) {
        const incrementalText = formatCode.slice(indexRef.current)
        indexRef.current = formatCode.length
        const { stable, unstable, recall } = await tokenizerRef.current.enqueue(incrementalText)
        const chunkTokens = [...stable, ...unstable]
        if (recall > 0) {
          setTokens((prev) => prev.slice(0, -recall))
        }
        for (const token of chunkTokens) {
          setTokens((prev) => {
            let result = [...prev]
            result = [...prev, token]
            return result
          })
        }
      }
    }
    updateStreamTokens()
  }, [code])

  return (
    <div className='group relative my-4 w-0 min-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0f0f10] shadow-lg'>
      <div className='text-muted-foreground flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs'>
        <span className='font-mono tracking-wide text-white/90 uppercase select-none'>{lang}</span>

        <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
          <button
            onClick={handleCopy}
            className='inline-flex h-7 w-7 items-center justify-center rounded-md'
            aria-label='Copy code'
          >
            {copied ? (
              <Check className='h-4 w-4 text-green-400' />
            ) : (
              <Copy className='h-4 w-4 text-white/90' />
            )}
          </button>
        </div>
      </div>
      <pre
        className={cn('hightligh-code-wrapper overflow-auto rounded bg-[#181818]', '!my-0')}
        style={{ ...THEME.dark, fontSize: '14px' }}
      >
        <code>
          {tokens.map((t, i) => (
            <span
              key={i}
              style={{
                color: t.color,
                backgroundColor: t.bgColor,
                ...t.htmlStyle,
              }}
              {...t.htmlAttrs}
            >
              {t.content}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
})

function getCodeLanguage(codeElement: ReactElement<any>) {
  if (!codeElement.props.className) return ''
  // eslint-disable-next-line no-unsafe-optional-chaining
  const [_, language] = codeElement.props.className?.split('language-')
  return language as string
}
