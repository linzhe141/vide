import {
  type BundledLanguage,
  type Highlighter,
  type SpecialLanguage,
  createHighlighterCore,
  createOnigurumaEngine,
} from 'shiki'
import { shikiTheme } from './codeTheme'
let highlighter: Highlighter | null = null

export type Language = {
  name: string
  src: () => Promise<any>
}

const DEFAULT_LANG = 'ts'

export const defaultLangs = {
  json: import('@shikijs/langs/json'),
  bash: import('@shikijs/langs/bash'),
  vue: import('@shikijs/langs/vue'),
  ts: import('@shikijs/langs/ts'),
  tsx: import('@shikijs/langs/tsx'),
  css: import('@shikijs/langs/css'),
  html: import('@shikijs/langs/html'),
  python: import('@shikijs/langs/python'),
  go: import('@shikijs/langs/go'),
  rust: import('@shikijs/langs/rust'),
  java: import('@shikijs/langs/java'),
}

export async function initShikiHighlighter() {
  if (highlighter) return highlighter
  const _highlighter = await createHighlighterCore({
    themes: [shikiTheme],
    langs: Object.values(defaultLangs),
    engine: createOnigurumaEngine(() => import('shiki/wasm')),
  })
  highlighter = _highlighter as Highlighter
}

export function codeToTokens(input: string, lang: string) {
  // @ts-expect-error ignore
  if (!defaultLangs[lang]) lang = DEFAULT_LANG
  const tokens = highlighter!.codeToTokens(input, {
    lang: lang as BundledLanguage | SpecialLanguage,
    theme: 'css-variables',
  })
  return tokens
}
