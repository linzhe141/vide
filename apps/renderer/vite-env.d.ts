/// <reference types="vite/client" />

import type { IpcRendererApi } from '@vide/main/ipc'
declare global {
  interface Window {
    ipcRendererApi: IpcRendererApi
  }
}
