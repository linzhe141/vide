import { createRoot } from 'react-dom/client'
import './index.css'
import './style.css'
import App from './App'
// import App from './MarkDownStreamRender'
import { createElectronSettingStore } from '@/store/electronSettingStore'
import { initShikiHighlighter } from '@/components/highlight/shiki'
import { appLogoUrl } from '@/lib/appLogo'

function syncAppFavicon() {
  const existingLink = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  const faviconLink = existingLink ?? document.createElement('link')

  faviconLink.rel = 'icon'
  faviconLink.type = 'image/png'
  faviconLink.href = appLogoUrl

  if (!existingLink) {
    document.head.appendChild(faviconLink)
  }
}

await Promise.all([createElectronSettingStore(), initShikiHighlighter()])

syncAppFavicon()

createRoot(document.getElementById('root')!).render(<App />)
