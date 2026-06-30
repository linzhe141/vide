/// <reference types="vite/client" />

import type { IpcRendererApi } from '@vide/main/ipcRenderer'
declare global {
  interface Window {
    ipcRendererApi: IpcRendererApi
  }
}
