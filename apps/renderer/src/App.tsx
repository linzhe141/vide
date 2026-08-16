import { RouterProvider } from 'react-router'
import { router } from './routes'
import { ThemeProvider } from './provider/ThemeProvider'
import { WechatSessionSync } from './components/wechat/WechatSessionSync'

function App() {
  return (
    <>
      <ThemeProvider>
        <RouterProvider router={router} />
        <WechatSessionSync />
      </ThemeProvider>
    </>
  )
}

export default App
