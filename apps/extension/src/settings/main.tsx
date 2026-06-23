import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { type Theme } from '@sip/types'
import { Settings } from '@sip/ui'
import { chromePlatform } from '../platform'
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
    chromePlatform.getPrefs().then(p => applyTheme(p.theme))
    return chromePlatform.onPrefsChanged(p => applyTheme(p.theme))
  }, [])

  return <Settings platform={chromePlatform} onClose={() => window.close()} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsPage />
  </StrictMode>,
)
