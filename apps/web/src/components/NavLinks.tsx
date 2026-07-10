'use client'

// Web-only right side of the top nav, injected into Settings' headerRight slot.
// The extension doesn't render this — it keeps the default close button.

import { useState } from 'react'
import InfoModal from './InfoModal'

// Download href lands later — button for now so there's no dead-anchor semantics
function NavLink({ children, onClick }: { children: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer bg-transparent border-0 p-0 appearance-none outline-none font-medium text-text-tertiary hover:text-text-secondary transition-colors"
      style={{ fontSize: 14, lineHeight: '18px' }}
    >
      {children}
    </button>
  )
}

export default function NavLinks() {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <>
      <nav className="flex items-center gap-3">
        <NavLink onClick={() => setInfoOpen(true)}>Info</NavLink>
        <NavLink>Download</NavLink>
      </nav>
      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
    </>
  )
}
