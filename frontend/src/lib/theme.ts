export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'ss-theme'
const THEME_COLORS: Record<Theme, string> = { light: '#fbfbfa', dark: '#0e0e13' }

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

/** The theme currently in effect: an explicit choice, otherwise the OS preference. */
export function getTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return systemQuery().matches ? 'dark' : 'light'
}

export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const query = systemQuery()
  query.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    query.removeEventListener('change', onChange)
  }
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the choice just won't persist.
  }
}
