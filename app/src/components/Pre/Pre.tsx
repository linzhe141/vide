import { useEffect, useRef, memo, useMemo, type PropsWithChildren, type ReactElement } from 'react'
import { cn } from '../../lib/utils'
import { THEME } from '../highlight/codeTheme'
import type { ThemedToken } from 'shiki'
import { highlighter, defaultLangs, FALLBACK_LANG } from '../highlight/shiki'
import { ShikiStreamTokenizer } from 'shiki-stream'
import { Copy, Check } from 'lucide-react'
import { useMarkdown } from '../markdown/MarkdownProvider'
import { useState } from 'react'

export const Pre = memo(function Pre(props: PropsWithChildren) {
  const { animation } = useMarkdown()
  const codeElement = props.children as ReactElement<PropsWithChildren>

  const code = codeElement?.props?.children ?? ''
  const language = getCodeLanguage(codeElement)

  if (animation) {
    if (code) {
      return <StreamBlock code={String(code)} lang={language} />
    }
    return null
  }

  return <MemoCodeBlock code={String(code)} lang={language} />
})

/**
 * ✅ 只要 code / lang 不变，就不会重新 render
 */
const MemoCodeBlock = memo(CodeBlock, (prev, next) => {
  return prev.code === next.code && prev.lang === next.lang
})

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  console.log('render CodeBlock~~~')

  const formatLang = lang as keyof typeof defaultLangs
  const highlightLang = defaultLangs[formatLang] !== undefined ? formatLang : FALLBACK_LANG

  /**
   * ✅ 核心优化：只在 code 变化时计算 tokens
   */
  const tokens = useMemo(() => {
    const result = highlighter!.codeToTokens(code, {
      lang: highlightLang,
      theme: 'css-variables',
    })
    return result.tokens
  }, [code, highlightLang])

  return (
    <CodeBlockWrapper lang={lang} code={code}>
      <code>
        {tokens.map((line, i) => (
          <span key={i} className='block'>
            {line.map((t, idx) => (
              <span
                key={idx}
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
          </span>
        ))}
      </code>
    </CodeBlockWrapper>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TokenSpan({ token }: { token: ThemedToken }) {
  return (
    <span
      style={{
        color: token.color,
        backgroundColor: token.bgColor,
        ...token.htmlStyle,
      }}
      {...token.htmlAttrs}
    >
      {token.content}
    </span>
  )
}

/**
 * ✅ 独立 CopyButton，避免影响整个 CodeBlock
 */
const CopyButton = memo(function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
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
  )
})

function CodeBlockWrapper({
  lang,
  code,
  children,
}: PropsWithChildren<{ lang: string; code: string }>) {
  return (
    <div className='relative my-4 w-0 min-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0f0f10] shadow-lg'>
      <div className='text-muted-foreground sticky top-0 z-10 flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs'>
        <span className='font-mono tracking-wide text-white/90 uppercase select-none'>{lang}</span>

        <div className='flex items-center gap-1'>
          <CopyButton code={code} />
        </div>
      </div>

      <pre
        className={cn('hightligh-code-wrapper overflow-auto rounded bg-[#181818] p-2', '!my-0')}
        style={{ ...THEME.dark, fontSize: '14px' }}
      >
        {children}
      </pre>
    </div>
  )
}

/**
 * ✅ 流式部分不动（已经绕过 React）
 */
function StreamBlock({ code, lang }: { code: string; lang: string }) {
  const formatLang = lang as keyof typeof defaultLangs
  const highlightLang = defaultLangs[formatLang] !== undefined ? formatLang : FALLBACK_LANG

  const indexRef = useRef(0)
  const codeContainerRef = useRef<HTMLElement>(null)
  const tokenizerRef = useRef<ShikiStreamTokenizer>(null!)

  useEffect(() => {
    tokenizerRef.current = new ShikiStreamTokenizer({
      highlighter: highlighter!,
      lang: highlightLang,
      theme: 'css-variables',
    })
    if (codeContainerRef.current) {
      codeContainerRef.current.innerHTML = ''
    }
    indexRef.current = 0
  }, [highlightLang, lang])

  useEffect(() => {
    async function updateStreamTokens() {
      let formatCode = code
      if (code.at(-1) === '\n') formatCode = code.slice(0, -1)

      if (formatCode.length > indexRef.current) {
        const incrementalText = formatCode.slice(indexRef.current)
        indexRef.current = formatCode.length

        const { stable, unstable, recall } = await tokenizerRef.current.enqueue(incrementalText)

        const chunkTokens = [...stable, ...unstable]

        if (codeContainerRef.current) {
          if (recall > 0) {
            let count = 0
            let node = codeContainerRef.current.lastChild
            while (node && count < recall) {
              const next = node.previousSibling
              node.remove()
              node = next
              count++
            }
          }

          chunkTokens.forEach((token) => {
            const span = document.createElement('span')
            if (token.color) span.style.color = token.color
            if (token.bgColor) span.style.backgroundColor = token.bgColor
            if (token.htmlStyle) {
              Object.assign(span.style, token.htmlStyle)
            }
            if (token.htmlAttrs) {
              Object.assign(span, token.htmlAttrs)
            }
            span.textContent = token.content
            codeContainerRef.current!.appendChild(span)
          })
        }
      }
    }

    updateStreamTokens()
  }, [code])

  return (
    <CodeBlockWrapper lang={lang} code={code}>
      <code ref={codeContainerRef} />
    </CodeBlockWrapper>
  )
}

function getCodeLanguage(codeElement: ReactElement<any>) {
  if (!codeElement?.props?.className) return ''
  const [, language] = codeElement.props.className.split('language-')
  return language || ''
}
