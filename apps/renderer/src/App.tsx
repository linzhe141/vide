import { RouterProvider } from 'react-router'
import { router } from './routes'
import { ThemeProvider } from './provider/ThemeProvider'
import { useAgentSessionEvent } from './hooks/useAgentSessionEvent'

function App() {
  // 全局挂载一次 agent 事件长连接，统一接收所有 workflow / session 级 IPC 事件
  useAgentSessionEvent()
  return (
    <>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </>
  )
}

export default App
