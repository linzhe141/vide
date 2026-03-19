import { useEffect, useRef, useState } from 'react'
import { md } from './md-demo'
import { MarkdownRenderer } from './components/markdown/MarkdownRenderer'
import { Titlebar } from './layout/RootLayout/Titlebar'

let index = 0
function App() {
  const [source, setSource] = useState('')
  const timer = useRef<number | null>(null)
  useEffect(() => {
    timer.current = window.setInterval(() => {
      const size = 40
      setSource(md.slice(0, index + size))
      index = index + size
    }, 50)
    return () => {
      clearInterval(timer.current!)
    }
  }, [])
  return (
    <div>
      <div className='fixed top-0 right-0 left-0 z-50 bg-black'>
        <Titlebar></Titlebar>
      </div>
      <div className='p-10'>
        <MarkdownRenderer animation>{source}</MarkdownRenderer>
      </div>
    </div>
  )
}

export default App
