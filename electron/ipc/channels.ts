import type { Settings } from '@/electron/store/settingsStore'
export interface RenderChannel {
  // electron store
  'get-store': () => Settings
  'dispatch-store': (data: Record<string, unknown>) => void

  // window
  'maxmize-window': () => void
  'minmize-window': () => void
  'close-window': () => void
}

export interface MainChannel {
  // example
  sendChunk: (chunk: string) => void
  foo: (data: Record<'foo', 'bar'>) => void
  ping: () => void

  // window
  'changed-window-size': (isMaximized: boolean) => void
}
