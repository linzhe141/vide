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
      setSource(md.slice(0, index + 4))
      index = index + 4
    }, 30)
    return () => {
      clearInterval(timer.current!)
    }
  }, [])
  return (
    <div>
      <div className='fixed top-0 right-0 left-0 bg-black'>
        <Titlebar></Titlebar>
      </div>
      <div className='p-10'>
        <MarkdownRenderer animation>{source}</MarkdownRenderer>
      </div>
    </div>
  )
}

export default App
