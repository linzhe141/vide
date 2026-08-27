import { startTransition, useEffect } from 'react'
import type { GitHubAuthRuntimeStatus } from '@vide/config'
import { RouterProvider } from 'react-router'
import { router } from './routes'
import { ThemeProvider } from './provider/ThemeProvider'
import { useAgentSessionEvent } from './hooks/useAgentSessionEvent'

function App() {
  // 全局挂载一次 agent 事件长连接，统一接收所有 workflow / session 级 IPC 事件
  useAgentSessionEvent()

  useEffect(() => {
    const shouldRevealAuthPage = (status: GitHubAuthRuntimeStatus) => {
      return status.authenticated || (!!status.lastError && !status.pending)
    }

    return window.ipcRendererApi.on('github-auth-status-changed', (status) => {
      if (!shouldRevealAuthPage(status)) return

      startTransition(() => {
        router.navigate('/settings/github')
      })
    })
  }, [])

  return (
    <>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </>
  )
}

export default App
