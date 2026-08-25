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
    // No padding of any kind here. v2's Settings is a full-height flex tree that
    // owns its own gutters — the nav's 16/32 and the body's 16 — and it must be
    // able to fill 100dvh for the preview to stay pinned while only the control
    // column scrolls. Anything added by the shell would push it past the fold.
    <div className="w-full max-w-[2240px] mx-auto">
      <Settings platform={webPlatform} onClose={() => window.close()} headerRight={<NavLinks />} />
    </div>
  )
}
