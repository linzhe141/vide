import { type Highlighter, createHighlighterCore, createOnigurumaEngine } from 'shiki'
import { shikiTheme } from './codeTheme'
let highlighter: Highlighter | null = null

export type Language = {
  name: string
  src: () => Promise<any>
}

const LANGUAGES: { [index: string]: Language } = {
  json: {
    name: 'JSON',
    src: () => import('shiki/langs/json.mjs'),
  },
}
export async function initShikiHighlighter() {
  if (highlighter) return highlighter
  const _highlighter = await createHighlighterCore({
    themes: [shikiTheme],
    langs: [LANGUAGES.json.src()],
    engine: createOnigurumaEngine(() => import('shiki/wasm')),
  })
  highlighter = _highlighter as Highlighter
}

export function codeToHtml(input: string) {
  const html = highlighter!.codeToHtml(input, {
    lang: 'json',
    theme: 'css-variables',
  })
  return html
}
