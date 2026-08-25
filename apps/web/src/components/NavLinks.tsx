'use client'

// Web-only right side of the top nav, injected into Settings' headerRight slot.
// The extension doesn't render this — it keeps the default close button.

import { useState } from 'react'
import InfoModal from './InfoModal'
import { CHROME_STORE_URL } from '../links'

// href → anchor (Download, out to the Web Store); onClick → button (Info modal).
// 14px semibold, -0.03em — the v2 nav scale, matching the gradient wordmark
// opposite so the two clusters sit on one optical line.
// 16px on desktop, 14px once the nav is competing with the brand mark for a
// narrow line. Sizing lives in classes rather than an inline style so it can be
// responsive at all — `narrow` is max-width:659px, the same line the layout
// stacks on.
const navCls = 'cursor-pointer bg-transparent border-0 p-0 appearance-none outline-none no-underline font-semibold text-text-muted hover:text-text-secondary transition-colors text-[16px] narrow:text-[14px] leading-[1.25] tracking-normal'

function NavLink({ children, href, onClick }: { children: string; href?: string; onClick?: () => void }) {
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={navCls}>{children}</a>
    : <button type="button" onClick={onClick} className={navCls}>{children}</button>
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
