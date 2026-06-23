'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { type Theme } from '@sip/types'
import { webPlatform } from '../platform'

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
    <div className="w-full max-w-[2240px] mx-auto p-pad-xl box-border">
      <Settings platform={webPlatform} onClose={() => window.close()} />
    </div>
  )
}
