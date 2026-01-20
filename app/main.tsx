import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './style.css'
import App from './src/App'
import { createElectronSettingStore } from '@/app/src/store/electronSettingStore'
import { initShikiHighlighter } from '@/app/src/components/highlight/shiki'

await Promise.all([createElectronSettingStore(), initShikiHighlighter()])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
