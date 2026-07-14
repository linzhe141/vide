import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getSiteIcon = (url: string) => {
  function domain(url: string) {
    try {
      const u = new URL(url)
      return u.hostname.replace(/^www\./, '')
    } catch (_) {
      return url
    }
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain(url))}&sz=64`
}
