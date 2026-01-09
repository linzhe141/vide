import { settingsStore } from '@/electron/store/settingsStore'
import { ipcMainApi } from '../ipcMain'

export function setupIpcMainHandle() {
  ipcMainApi.handle('get-store', () => {
    return settingsStore.store
  })

  ipcMainApi.handle('dispatch-store', (data) => {
    Object.entries(data).forEach(([key, newValue]) => {
      settingsStore.set(key, newValue)
    })

    ipcMainApi.send('sendChunk', 'chunk~')
    ipcMainApi.send('ping')
    type FooChannelParams = Parameters<typeof ipcMainApi.send<'foo'>>[1]
    const params: FooChannelParams = {
      foo: 'bar',
    }
    ipcMainApi.send('foo', params)
  })
}
