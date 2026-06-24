/// <reference types="vite/client" />

import type { IpcRendererApi } from '../main/src/ipc/api/ipcRenderer'
declare global {
  interface Window {
    ipcRendererApi: IpcRendererApi
  }
}
