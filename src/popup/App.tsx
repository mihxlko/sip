import { useEffect, useState } from 'react'
import { getPrefs } from '../types/prefs'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── app ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [remaining, setRemaining] = useState<number | null>(null)

  // Sync theme preference to <html> so tokens.css dark overrides take effect
  useEffect(() => {
    getPrefs().then(({ theme }) => {
      const html = document.documentElement
      if (theme === 'system') html.removeAttribute('data-theme')
      else html.setAttribute('data-theme', theme)
    })
  }, [])

  // Poll alarm every second to keep countdown accurate
  useEffect(() => {
    async function tick() {
      const alarm = await chrome.alarms.get('sip-reminder')
      setRemaining(alarm ? alarm.scheduledTime - Date.now() : null)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  function openSettings() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/settings/index.html') })
  }

  const display = remaining === null ? '--:--' : fmtCountdown(remaining)

  return (
    <div className="w-[280px] bg-surface-base p-pad-lg font-sans antialiased flex flex-col gap-gap-sm">

      {/* logo */}
      <SipBadge />

      {/* countdown */}
      <div className="flex flex-col items-center gap-xs py-gap-sm">
        {/* letter-spacing 0.06em — no positive tracking token */}
        <span className="text-sm font-medium text-text-muted" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Next sip in
        </span>
        {/* 36px — no token between text-lg (16px) and text-xl (60px) */}
        <span className="font-semibold text-text-primary" style={{ fontSize: 36, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {display}
        </span>
      </div>

      {/* open settings */}
      <button
        onClick={openSettings}
        className="w-full cursor-pointer bg-surface-elevated border-0.5 border-border-default rounded-md shadow-subtle py-pad-sm text-md font-medium text-text-secondary outline-none appearance-none"
      >
        Open Settings
      </button>
    </div>
  )
}

// ─── SIP badge ────────────────────────────────────────────────────────────────

function SipBadge() {
  return (
    <svg width="39" height="25" viewBox="0 0 28 18" fill="none">
      <defs>
        <linearGradient id="sip-grad-popup" x1="14" y1="0" x2="14" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#79D4EE" />
          <stop offset="1" stopColor="#51A0EA" />
        </linearGradient>
      </defs>
      <rect width="28" height="18" rx="8" fill="url(#sip-grad-popup)" />
      <path d="M9.101 13.117C7.694 13.117 6.757 12.531 6.483 11.73C6.439 11.613 6.415 11.486 6.415 11.369C6.415 11.018 6.64 10.793 6.972 10.793C7.25 10.793 7.426 10.905 7.563 11.188C7.782 11.799 8.388 12.072 9.14 12.072C9.989 12.072 10.585 11.652 10.585 11.066C10.585 10.559 10.233 10.246 9.315 10.056L8.559 9.899C7.147 9.611 6.488 8.947 6.488 7.917C6.488 6.677 7.577 5.837 9.105 5.837C10.351 5.837 11.317 6.394 11.605 7.326C11.635 7.404 11.649 7.497 11.649 7.614C11.649 7.922 11.43 8.132 11.102 8.132C10.81 8.132 10.629 8.005 10.497 7.731C10.258 7.136 9.755 6.882 9.096 6.882C8.314 6.882 7.758 7.253 7.758 7.844C7.758 8.322 8.109 8.63 8.988 8.815L9.745 8.972C11.229 9.279 11.854 9.875 11.854 10.92C11.854 12.268 10.795 13.117 9.101 13.117ZM13.632 13.083C13.241 13.083 13.002 12.844 13.002 12.429V6.525C13.002 6.11 13.241 5.871 13.632 5.871C14.027 5.871 14.261 6.11 14.261 6.525V12.429C14.261 12.844 14.027 13.083 13.632 13.083ZM16.332 13.083C15.941 13.083 15.702 12.844 15.702 12.429V6.608C15.702 6.198 15.941 5.954 16.332 5.954H18.441C19.842 5.954 20.814 6.906 20.814 8.313C20.814 9.719 19.813 10.671 18.387 10.671H16.962V12.429C16.962 12.844 16.727 13.083 16.332 13.083ZM16.962 9.655H18.104C19.007 9.655 19.535 9.167 19.535 8.313C19.535 7.468 19.012 6.984 18.109 6.984H16.962V9.655Z" fill="#FBFEFE" />
    </svg>
  )
}
