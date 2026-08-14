import { ToolCallError } from '../../error'
import { defineTool, ToolProvider } from '../toolProvider'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
// @ts-expect-error ignore missing types
import { gfm } from 'turndown-plugin-gfm'

export const WEBSEARCH_TOOL_NAMES = {
  SEARCH: 'websearch',
  FETCH: 'webfetch',
} as const

type SerperOrganicResult = {
  title?: string
  link?: string
  snippet?: string
  date?: string
  position?: number
}

type SerperPeopleAlsoAskResult = {
  question?: string
  title?: string
  link?: string
  snippet?: string
}

type SerperRelatedSearch = {
  query?: string
}

type SerperSearchResponse = {
  searchParameters?: {
    q?: string
    type?: string
    engine?: string
  }
  searchInformation?: {
    didYouMean?: string
  }
  organic?: SerperOrganicResult[]
  peopleAlsoAsk?: SerperPeopleAlsoAskResult[]
  relatedSearches?: SerperRelatedSearch[]
  credits?: number
}

const DEFAULT_RESULT_LIMIT = 8
const MAX_RESULT_LIMIT = 10

export class WebSearch extends ToolProvider {
  search = defineTool({
    name: WEBSEARCH_TOOL_NAMES.SEARCH,
    type: 'function',
    function: {
      name: WEBSEARCH_TOOL_NAMES.SEARCH,
      description:
        'Search the web with Google results through Serper. Use this for current events, facts that may have changed, or questions that need external sources. Returns titles, links, snippets, related questions, and related searches.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of organic results to return. Defaults to 8, maximum 10.',
          },
        },
        required: ['query'],
      },
    },

    executor: async (args: any = {}) => {
      const query = typeof args.query === 'string' ? args.query.trim() : ''
      const limit = normalizeLimit(args.limit)

      if (!query) {
        throw new ToolCallError('Search query is required')
      }

      const apiUrl = this.runtime.agentSettings.webSearchConfig?.apiUrl?.trim()
      const apiKey = this.runtime.agentSettings.webSearchConfig?.apiKey?.trim()

      if (!apiUrl || !apiKey) {
        throw new ToolCallError('Web search is not configured. Please goto Web Search Settings.')
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query }),
        signal: this.runtime.signal,
      })

      if (!response.ok) {
        throw new ToolCallError(`Web search failed with HTTP ${response.status}`)
      }

      const data = (await response.json()) as SerperSearchResponse

      return {
        reason: 'call-llm',
        result: {
          query,
          didYouMean: data.searchInformation?.didYouMean,
          results: await Promise.all(
            (data.organic ?? [])
              .slice(0, limit)
              .filter((i) => i.link)
              .map(async (item, index) => ({
                title: item.title ?? 'Untitled result',
                link: item.link!,
                snippet: item.snippet ?? '',
                date: item.date,
                position: item.position ?? index + 1,
                content: await fetchPageContent(item.link!),
              }))
          ),
          peopleAlsoAsk: (data.peopleAlsoAsk ?? []).slice(0, 4).map((item) => ({
            question: item.question ?? '',
            title: item.title ?? '',
            link: item.link ?? '',
            snippet: item.snippet ?? '',
          })),
          relatedSearches: (data.relatedSearches ?? [])
            .slice(0, 6)
            .map((item) => item.query)
            .filter(Boolean),
          credits: data.credits,
        },
      }
    },
  })

  fetchContent = defineTool({
    name: WEBSEARCH_TOOL_NAMES.FETCH,
    type: 'function',
    function: {
      name: WEBSEARCH_TOOL_NAMES.FETCH,
      description: 'Fetch content from a given URL.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch content from.',
          },
        },
        required: ['url'],
      },
    },

    executor: async (args: any = {}) => {
      const url = typeof args.url === 'string' ? args.url.trim() : ''

      if (!url) {
        throw new ToolCallError('URL is required')
      }

      const content = await fetchPageContent(url)
      return {
        reason: 'call-llm',
        result: {
          url,
          content,
        },
      }
    },
  })

  getTools() {
    return [this.search, this.fetchContent]
  }
}

function normalizeLimit(limit: unknown) {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_RESULT_LIMIT
  return Math.min(Math.max(Math.round(limit), 1), MAX_RESULT_LIMIT)
}

function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  turndown.use(gfm)
  turndown.addRule('removeEmptyLinks', {
    filter: (node) => node.nodeName === 'A' && !node.textContent?.trim(),
    replacement: () => '',
  })
  return turndown
    .turndown(html)
    .replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, '')
    .replace(/ +/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return `(HTTP ${response.status})`
    }

    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (article && article.content) {
      return htmlToMarkdown(article.content).substring(0, 5000)
    }

    // Fallback: try to get main content
    const fallbackDoc = new JSDOM(html, { url })
    const body = fallbackDoc.window.document
    body
      .querySelectorAll('script, style, noscript, nav, header, footer, aside')
      .forEach((el) => el.remove())
    const main = body.querySelector("main, article, [role='main'], .content, #content") || body.body
    const text = main?.textContent || ''

    if (text.trim().length > 100) {
      return text.trim().substring(0, 5000)
    }

    return '(Could not extract content)'
  } catch (e: any) {
    return `(Error: ${e.message})`
  }
}
