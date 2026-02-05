import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react'
import { cn } from '../../lib/utils'
import { THEME } from '../highlight/codeTheme'
import type { ThemedToken } from 'shiki'
import { highlighter, defaultLangs, FALLBACK_LANG } from '../highlight/shiki'
import { ShikiStreamTokenizer } from 'shiki-stream'
import { Copy, Check } from 'lucide-react'
import { useMarkdown } from '../markdown/MarkdownProvider'

export const Pre = memo(function Pre(props: PropsWithChildren) {
  const { animation } = useMarkdown()
  const codeElement = props.children as ReactElement<PropsWithChildren>
  const code = codeElement.props.children
  const language = getCodeLanguage(codeElement)
  if (animation) {
    if (code) {
      return <StreamBlock code={String(code)} lang={language}></StreamBlock>
    }
    return null
  }
  return <CodeBlock code={String(code)} lang={language}></CodeBlock>
})

const CodeBlock = memo(function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const formatLang = lang as keyof typeof defaultLangs

  const highlightLang = defaultLangs[formatLang] !== undefined ? formatLang : FALLBACK_LANG

  function getTokens(input: string) {
    const result = highlighter!.codeToTokens(input, {
      lang: highlightLang,
      theme: 'css-variables',
    })
    return result.tokens
  }

  const tokens = getTokens(code)

  return (
    <CodeBlockWrapper lang={lang} code={code}>
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
    </CodeBlockWrapper>
  )
})

const TokenSpan = memo(function TokenSpan({ token }: { token: ThemedToken }) {
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
})

const StreamBlock = memo(function StreamBlock({ code, lang }: { code: string; lang: string }) {
  const formatLang = lang as keyof typeof defaultLangs

  const highlightLang = defaultLangs[formatLang] !== undefined ? formatLang : FALLBACK_LANG

  const indexRef = useRef(0)
  const [tokens, setTokens] = useState<ThemedToken[]>([])
  const tokenizerRef = useRef<ShikiStreamTokenizer>(null!)

  useEffect(() => {
    tokenizerRef.current = new ShikiStreamTokenizer({
      highlighter: highlighter!,
      lang: highlightLang,
      theme: 'css-variables',
    })
  }, [highlightLang])

  useEffect(() => {
    async function updateStreamTokens() {
      let formatCode = code
      if (code.at(-1) === '\n') formatCode = code.slice(0, -1)
      if (formatCode.length > indexRef.current) {
        const incrementalText = formatCode.slice(indexRef.current)
        indexRef.current = formatCode.length

        const start = performance.now()

        const { stable, unstable, recall } = await tokenizerRef.current.enqueue(incrementalText)

        const end = performance.now()
        const ms = end - start
        const seconds = ms / 1000
        console.log(`enqueue 耗时: ${seconds.toFixed(3)} 秒`)

        const chunkTokens = [...stable, ...unstable]
        setTokens((prev) => {
          // 处理recall
          const baseTokens = recall > 0 ? prev.slice(0, -recall) : prev
          // 一次性添加所有新tokens
          return [...baseTokens, ...chunkTokens]
        })
      }
    }
    updateStreamTokens()
  }, [code])
  // 使用useMemo缓存渲染结果
  const renderedTokens = useMemo(() => {
    return tokens.map((t, i) => <TokenSpan key={i} token={t} />)
  }, [tokens])

  return (
    <CodeBlockWrapper lang={lang} code={code}>
      {renderedTokens}
      {/* {code} */}
    </CodeBlockWrapper>
  )
})

function getCodeLanguage(codeElement: ReactElement<any>) {
  if (!codeElement.props.className) return ''
  // eslint-disable-next-line no-unsafe-optional-chaining
  const [_, language] = codeElement.props.className?.split('language-')
  return language as string
}

function CodeBlockWrapper({
  lang,
  code,
  children,
}: PropsWithChildren<{ lang: string; code: string }>) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className='relative my-4 w-0 min-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0f0f10] shadow-lg'>
      <div className='text-muted-foreground flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs'>
        <span className='font-mono tracking-wide text-white/90 uppercase select-none'>{lang}</span>

        <div className='flex items-center gap-1'>
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
        <code>{children}</code>
      </pre>
    </div>
  )
}
