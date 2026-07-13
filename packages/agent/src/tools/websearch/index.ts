import { ToolCallError } from '../../error'
import { defineTool, ToolProvider } from '../toolProvider'

export const WEBSEARCH_TOOL_NAMES = {
  SEARCH: 'websearch',
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

      const searchUrl = this.runtime.webSearchConfig?.searchUrl?.trim()
      const apiKey = this.runtime.webSearchConfig?.apiKey?.trim()

      if (!searchUrl || !apiKey) {
        throw new ToolCallError('Web search is not configured. Please goto Web Search Settings.')
      }

      const response = await fetch(searchUrl, {
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
          results: (data.organic ?? []).slice(0, limit).map((item, index) => ({
            title: item.title ?? 'Untitled result',
            link: item.link ?? '',
            snippet: item.snippet ?? '',
            date: item.date,
            position: item.position ?? index + 1,
          })),
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

  getTools() {
    return [this.search]
  }
}

function normalizeLimit(limit: unknown) {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_RESULT_LIMIT
  return Math.min(Math.max(Math.round(limit), 1), MAX_RESULT_LIMIT)
}
