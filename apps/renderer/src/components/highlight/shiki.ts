import { type Highlighter, createHighlighterCore, createJavaScriptRegexEngine } from 'shiki'
import { shikiTheme } from './codeTheme'
export let highlighter: Highlighter = null!

export function getHighlighter() {
  return highlighter
}

export const FALLBACK_LANG = 'tsx'

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
  if (highlighter) return
  const _highlighter = await createHighlighterCore({
    themes: [shikiTheme],
    langs: Object.values(defaultLangs),
    engine: createJavaScriptRegexEngine(),
  })
  highlighter = _highlighter as Highlighter
}
