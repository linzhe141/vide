import type { IpcRendererApi } from '@/electron/ipc/api/ipcRenderer'
declare global {
  interface Window {
    ipcRendererApi: IpcRendererApi
  }
}
