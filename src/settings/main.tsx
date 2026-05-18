import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { getPrefs, type Theme } from '../types/prefs'
import Settings from '../content/Settings'
import './index.css'

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'system') html.removeAttribute('data-theme')
  else html.setAttribute('data-theme', theme)
}

function SettingsPage() {
  // Sync theme to <html> on mount and on every prefs change so the page
  // background (var(--surface-base) on body) reflects the user's current choice.
  useEffect(() => {
    getPrefs().then(p => applyTheme(p.theme))
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'sync') return
      const next = changes.sipPrefs?.newValue
      if (next?.theme) applyTheme(next.theme)
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  return <Settings onClose={() => window.close()} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsPage />
  </StrictMode>,
)
