import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Clock3, CornerDownLeft, Search, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'
import { useHistoryItems, useHistoryStoreActions } from '@/store/historyStore'
import { useSessionStore } from '@/store/sessionStore'
import { Input } from '@/ui/Input'

type CommandItem = {
  id: string
  title: string
  subtitle: string
  kind: 'setting' | 'session'
  keywords: string[]
  to: string
  meta?: string
  running?: boolean
}

const settingItems: CommandItem[] = [
  {
    id: 'setting-general',
    title: 'General',
    subtitle: 'Appearance and personalization',
    kind: 'setting',
    keywords: ['settings', 'preferences', 'theme', 'accent color', 'clear database'],
    to: '/settings',
    meta: 'Settings',
  },
  {
    id: 'setting-llm',
    title: 'LLM Settings',
    subtitle: 'API Key, Base URL, model, verify connection',
    kind: 'setting',
    keywords: ['settings', 'llm', 'api key', 'base url', 'model', 'connection'],
    to: '/settings/llm',
    meta: 'Settings',
  },
  {
    id: 'setting-generate-image',
    title: 'Generate Image',
    subtitle: 'Image API Key, Base URL and model',
    kind: 'setting',
    keywords: ['settings', 'generate image', 'image', 'api key', 'base url', 'model'],
    to: '/settings/generateImage',
    meta: 'Settings',
  },
  {
    id: 'setting-web-search',
    title: 'Web Search',
    subtitle: 'Search URL and Serper API key',
    kind: 'setting',
    keywords: ['settings', 'web search', 'serper', 'search url', 'api key'],
    to: '/settings/webSearch',
    meta: 'Settings',
  },
  {
    id: 'setting-wechat',
    title: 'WeChat Bot',
    subtitle: 'QR login and authentication status',
    kind: 'setting',
    keywords: ['settings', 'wechat', 'bot', 'qr', 'login', 'authentication'],
    to: '/settings/wechat',
    meta: 'Settings',
  },
  {
    id: 'setting-github-auth',
    title: 'GitHub OAuth',
    subtitle: 'External browser sign-in and desktop callback',
    kind: 'setting',
    keywords: ['settings', 'github', 'oauth', 'login', 'auth', 'callback', 'protocol'],
    to: '/settings/github',
    meta: 'Settings',
  },
]

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function createSearchText(item: Pick<CommandItem, 'title' | 'subtitle' | 'keywords' | 'meta'>) {
  return normalize(
    [item.title, item.subtitle, item.meta, ...item.keywords].filter(Boolean).join(' ')
  )
}

function scoreItem(item: CommandItem, query: string) {
  if (!query) return item.kind === 'setting' ? 100 : 80

  const searchText = createSearchText(item)
  if (!searchText.includes(query)) return -1

  const exactTitle = normalize(item.title)
  const exactSubtitle = normalize(item.subtitle)

  if (exactTitle.startsWith(query)) return item.kind === 'setting' ? 300 : 280
  if (exactTitle.includes(query)) return item.kind === 'setting' ? 260 : 240
  if (exactSubtitle.includes(query)) return item.kind === 'setting' ? 220 : 200
  return item.kind === 'setting' ? 180 : 160
}

export function CommandPalette() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const historyItems = useHistoryItems()
  const historyActions = useHistoryStoreActions()
  const sessions = useSessionStore((state) => state.sessions)

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const openPalette = useCallback(() => {
    setOpen(true)
    setSelectedIndex(0)
  }, [])

  const togglePalette = useCallback(() => {
    if (open) {
      closePalette()
      return
    }

    openPalette()
  }, [closePalette, open, openPalette])

  const recentSessionItems = useMemo<CommandItem[]>(() => {
    return [...historyItems]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 20)
      .map((item) => ({
        id: `session-${item.sessionId}`,
        title: item.title || 'Untitled',
        subtitle:
          item.sessionSource === 'wechat-bot' ? 'Recent session · WeChat Bot' : 'Recent session',
        kind: 'session',
        keywords: [item.type, item.sessionSource, item.sessionId],
        to: `/chat/${item.sessionId}`,
        meta: item.sessionSource === 'wechat-bot' ? 'WeChat' : 'Desktop',
        running:
          sessions.find((session) => session.sessionId === item.sessionId)?.runtime.running ??
          false,
      }))
  }, [historyItems, sessions])

  const results = useMemo(() => {
    const normalizedQuery = normalize(query)
    const items = [...settingItems, ...recentSessionItems]

    return items
      .map((item) => ({ item, score: scoreItem(item, normalizedQuery) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .map((entry) => entry.item)
  }, [query, recentSessionItems])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isOpenShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p'
      if (!isOpenShortcut) return

      event.preventDefault()
      togglePalette()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePalette])

  useEffect(() => {
    if (!open) return

    if (historyItems.length === 0) {
      historyActions.fetch()
    }

    queueMicrotask(() => inputRef.current?.focus())
  }, [open, historyActions, historyItems.length])

  const activeItem = results[selectedIndex]

  function handleSelect(item: CommandItem) {
    navigate(item.to)
    closePalette()
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePalette()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((current) => (results.length === 0 ? 0 : (current + 1) % results.length))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((current) =>
        results.length === 0 ? 0 : (current - 1 + results.length) % results.length
      )
      return
    }

    if (event.key === 'Enter' && activeItem) {
      event.preventDefault()
      handleSelect(activeItem)
    }
  }

  if (!open) return null

  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm'>
      <button
        type='button'
        aria-label='Close command palette'
        className='absolute inset-0 cursor-default'
        onClick={closePalette}
      />

      <div className='bg-background border-border relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl'>
        <div className='border-border flex items-center gap-3 border-b px-4 py-3'>
          <Search className='text-text-secondary size-4' />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={onInputKeyDown}
            placeholder='Filter settings and recent sessions'
            className='border-0 bg-transparent px-0 py-1 text-sm shadow-none focus:border-0 focus:ring-0'
          />
          <div className='text-text-info rounded-md border px-2 py-1 text-xs'>Ctrl/Cmd+P</div>
        </div>

        <div className='max-h-[60vh] overflow-y-auto p-2'>
          {results.length > 0 ? (
            results.map((item, index) => {
              const isActive = index === selectedIndex
              return (
                <button
                  key={item.id}
                  type='button'
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                    isActive ? 'bg-foreground/8' : 'hover:bg-foreground/5'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      item.kind === 'setting'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-foreground/6 text-text-secondary'
                    )}
                  >
                    {item.kind === 'setting' ? (
                      <Settings2 className='size-4' />
                    ) : (
                      <Clock3 className='size-4' />
                    )}
                  </span>

                  <span className='min-w-0 flex-1'>
                    <span className='text-foreground block truncate text-sm font-medium'>
                      {item.title}
                    </span>
                    <span className='text-text-secondary block truncate text-xs'>
                      {item.subtitle}
                    </span>
                  </span>

                  <span className='flex items-center gap-2'>
                    {item.running ? (
                      <span className='bg-primary/10 text-primary rounded-full px-2 py-1 text-[11px]'>
                        Running
                      </span>
                    ) : null}
                    <span className='text-text-info rounded-md border px-2 py-1 text-[11px]'>
                      {item.meta}
                    </span>
                  </span>
                </button>
              )
            })
          ) : (
            <div className='text-text-secondary flex flex-col items-center gap-2 px-4 py-10 text-center'>
              <Search className='size-5 opacity-60' />
              <div className='text-sm font-medium'>No matching entry</div>
              <div className='text-xs'>Try a setting name, field label, or session title.</div>
            </div>
          )}
        </div>

        <div className='border-border text-text-secondary flex items-center justify-between border-t px-4 py-2 text-xs'>
          <div>Settings and recent sessions</div>
          <div className='flex items-center gap-3'>
            <span>↑↓ Navigate</span>
            <span className='inline-flex items-center gap-1'>
              <CornerDownLeft className='size-3' /> Open
            </span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
