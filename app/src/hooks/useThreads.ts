export function useThreads() {
  async function createThread() {
    await window.ipcRendererApi.invoke('agent-create-session')
  }

  return {
    createThread,
  }
}
