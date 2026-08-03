'use client'

// Web-only right side of the top nav, injected into Settings' headerRight slot.
// The extension doesn't render this — it keeps the default close button.

import { useState } from 'react'
import InfoModal from './InfoModal'
import { CHROME_STORE_URL } from '../links'

// href → anchor (Download, out to the Web Store); onClick → button (Info modal).
const navCls = 'cursor-pointer bg-transparent border-0 p-0 appearance-none outline-none no-underline font-medium text-text-tertiary hover:text-text-secondary transition-colors'
const navStyle = { fontSize: 14, lineHeight: '18px' } as const

function NavLink({ children, href, onClick }: { children: string; href?: string; onClick?: () => void }) {
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={navCls} style={navStyle}>{children}</a>
    : <button type="button" onClick={onClick} className={navCls} style={navStyle}>{children}</button>
}

export default function NavLinks() {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <>
      <nav className="flex items-center gap-3">
        <NavLink onClick={() => setInfoOpen(true)}>Info</NavLink>
        <NavLink href={CHROME_STORE_URL}>Download</NavLink>
      </nav>
      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
    </>
  )
}
