'use client'

// Header variant for /privacy. Mirrors the app's fixed top nav (brand on the
// left, action on the right) but: the brand is a link back home, and the Info
// modal link is dropped — a standalone legal page has no use for a modal nav.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ThemedLogo } from '@sip/ui'
import { type SipPrefs } from '@sip/types'
import { webPlatform } from '../platform'
import { CHROME_STORE_URL } from '../links'

// Same resolution the Settings header uses: explicit theme wins, else follow the
// OS media query. Kept local so this header stands alone without Settings.
function resolveIsDark(theme: SipPrefs['theme']): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function PrivacyHeader() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    let theme: SipPrefs['theme'] = 'system'
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const recompute = () => setDark(resolveIsDark(theme))

    webPlatform.getPrefs().then(p => { theme = p.theme; recompute() })
    const offPrefs = webPlatform.onPrefsChanged(p => { theme = p.theme; recompute() })
    mq.addEventListener('change', recompute)
    return () => { offPrefs(); mq.removeEventListener('change', recompute) }
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="w-full max-w-[2240px] mx-auto box-border px-pad-xl pt-pad-xl flex items-center justify-between">
        {/* brand → home (sip-hydra.vercel.app) */}
        <Link href="/" className="pointer-events-auto flex items-center gap-2 no-underline">
          <ThemedLogo platform={webPlatform} size={24} assetSize={64} dark={dark} />
          {/* 14px/18px gradient wordmark — matches the Settings header exactly */}
          <span
            className="font-medium text-transparent bg-clip-text"
            style={{
              fontSize: 14,
              lineHeight: '18px',
              backgroundImage: 'linear-gradient(in oklab 180deg, oklab(75% -0.113 -0.049) 0%, oklab(53.6% -0.009 -0.212) 100%)',
            }}
          >
            Sip Hydra
          </span>
        </Link>
        <div className="pointer-events-auto">
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer bg-transparent border-0 p-0 appearance-none outline-none no-underline font-medium text-text-tertiary hover:text-text-secondary transition-colors"
            style={{ fontSize: 14, lineHeight: '18px' }}
          >
            Download
          </a>
        </div>
      </div>
    </div>
  )
}
