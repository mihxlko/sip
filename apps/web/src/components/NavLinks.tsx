// Web-only right side of the top nav, injected into Settings' headerRight slot.
// The extension doesn't render this — it keeps the default close button.

// hrefs land later — buttons for now so there's no dead-anchor semantics
function NavLink({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="cursor-pointer bg-transparent border-0 p-0 appearance-none outline-none font-medium text-text-tertiary hover:text-text-secondary transition-colors"
      style={{ fontSize: 14, lineHeight: '18px' }}
    >
      {children}
    </button>
  )
}

export default function NavLinks() {
  return (
    <nav className="flex items-center gap-3">
      <NavLink>Info</NavLink>
      <NavLink>Download</NavLink>
    </nav>
  )
}
