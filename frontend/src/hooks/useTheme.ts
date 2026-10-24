import { useCallback, useSyncExternalStore } from 'react'

import { getTheme, setTheme, subscribeTheme, type Theme } from '../lib/theme'

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'light' as Theme)
  const toggle = useCallback(() => setTheme(getTheme() === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}
