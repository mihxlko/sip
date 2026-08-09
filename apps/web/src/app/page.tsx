'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { type Theme } from '@sip/types'
import { webPlatform } from '../platform'
import NavLinks from '../components/NavLinks'

// Settings reads `window` during render (theme/media-query resolution), so it
// must never be server-rendered — load it client-only.
const Settings = dynamic(() => import('@sip/ui').then(mod => mod.Settings), { ssr: false })

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'system') html.removeAttribute('data-theme')
  else html.setAttribute('data-theme', theme)
}

export default function Page() {
  useEffect(() => {
    webPlatform.getPrefs().then(p => applyTheme(p.theme))
    return webPlatform.onPrefsChanged(p => applyTheme(p.theme))
  }, [])

  return (
    // Horizontal padding is deliberately NOT set here: the app gutter is owned in
    // one place (Settings' own p-gap-lg = 24px) so the fixed nav, the card column
    // and the stacking breakpoint (920 = 872 + 24×2) all derive from one number.
    // Vertical padding stays — it's what the fixed nav's pt-pad-xl aligns to.
    <div className="w-full max-w-[2240px] mx-auto py-pad-xl box-border">
      <Settings platform={webPlatform} onClose={() => window.close()} headerRight={<NavLinks />} />
    </div>
  )
}
