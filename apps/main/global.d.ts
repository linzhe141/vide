import type { IpcRendererApi } from '@/ipc/api/ipcRenderer'
declare global {
  interface Window {
    ipcRendererApi: IpcRendererApi
  }
}
