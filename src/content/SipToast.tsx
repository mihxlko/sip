import { useEffect, useState } from 'react'
import { BottleColor, BottleType, type SipPrefs } from '../types/prefs'

// ─── constants ───────────────────────────────────────────────────────────────

const DISMISS_MS = 8_000
const FADE_MS    = 200

const BOTTLE_COLOR: Record<BottleColor, string> = {
  [BottleColor.Pink]:   '#FC7792',
  [BottleColor.Orange]: '#F47E47',
  [BottleColor.Yellow]: '#F2CE33',
  [BottleColor.Green]:  '#00B97D',
  [BottleColor.Blue]:   '#5FB2EB',
  [BottleColor.Purple]: '#B938F6',
}

const BOTTLE_FILE: Record<BottleType, string> = {
  [BottleType.Classic]: 'yetti.svg',
  [BottleType.Wide]:    'bibs.svg',
  [BottleType.Sport]:   'camelbak.svg',
}

function resolveIsDark(theme: SipPrefs['theme']): boolean {
  if (theme === 'dark')  return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props { prefs: SipPrefs; onDismiss: () => void; mode?: 'live' | 'preview' }

export default function SipToast({ prefs, onDismiss, mode = 'live' }: Props) {
  const [out, setOut] = useState(false)
  const dark        = resolveIsDark(prefs.theme)
  const bottleColor = BOTTLE_COLOR[prefs.bottleColor]

  useEffect(() => {
    const fade   = setTimeout(() => setOut(true), DISMISS_MS - FADE_MS)
    const remove = setTimeout(onDismiss,           DISMISS_MS)
    return () => { clearTimeout(fade); clearTimeout(remove) }
  }, [onDismiss])

  function dismiss() {
    setOut(true)
    setTimeout(onDismiss, FADE_MS)
  }

  function openPrefs() {
    if (mode === 'preview') return
    chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS_TAB' })
    dismiss()
  }

  return (
    <div className={`${out ? 'toast out' : 'toast'} w-[500px] bg-surface-elevated border-0.5 border-border-default rounded-xl shadow p-pad-xl flex flex-col overflow-clip font-sans antialiased`}>

      {/* ── inner row: toast-left + close × ── */}
      <div className="flex gap-gap-xxl items-start justify-between">

        {/* toast-left: bottle + main content */}
        <div className="flex gap-pad-xl items-start">

          {/* bottle */}
          <BottleIcon color={bottleColor} type={prefs.bottleType} />

          {/* main content */}
          <div className="flex flex-col gap-pad-xl">

            {/* header */}
            <div className="flex flex-col gap-0.5">

              {/* title row — max-w matches the message width so a long title
                  can't push main-content wider than the 350px message */}
              <div className="flex items-center gap-pad-sm max-w-[350px]">
                <span className="min-w-0 text-text-primary text-lg font-semibold leading-tight tracking-normal overflow-hidden text-ellipsis whitespace-nowrap">
                  {prefs.titleText}
                </span>

                {prefs.showLogo && (
                  <div className="shrink-0 mb-0.5">
                    {prefs.customIcon
                      ? <img src={prefs.customIcon} width={28} height={18} className="block rounded-md object-cover" />
                      : <SipBadge dark={dark} />
                    }
                  </div>
                )}
              </div>

              {/* message — 350px fixed; drives the toast's overall width */}
              <p className="m-0 w-[350px] text-text-muted text-sm font-medium leading-[16px]">
                {prefs.messageText}
              </p>
            </div>

            {/* edit preferences */}
            <button
              onClick={openPrefs}
              className="cursor-pointer bg-transparent border-0 p-0 outline-none appearance-none text-text-brand text-sm font-medium leading-[16px] w-fit"
            >
              Edit preferences
            </button>
          </div>
        </div>

        {/* close × */}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="cursor-pointer bg-transparent border-0 outline-none appearance-none shrink-0 leading-none p-xs text-text-muted"
        >
          <XIcon />
        </button>
      </div>
    </div>
  )
}

// ─── SIP badge ────────────────────────────────────────────────────────────────

function SipBadge({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <div style={{
        backgroundColor: '#5FB2EB',
        borderRadius: 8,
        padding: '3px 6px',
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
      }}>
        <span style={{ color: '#E4F7FB', fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' }}>
          SIP
        </span>
      </div>
    )
  }

  return (
    <svg width="28" height="18" viewBox="0 0 28 18" fill="none">
      <defs>
        <linearGradient id="sip-grad" x1="14" y1="0" x2="14" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#79D4EE" />
          <stop offset="1" stopColor="#51A0EA" />
        </linearGradient>
      </defs>
      <rect width="28" height="18" rx="8" fill="url(#sip-grad)" />
      <path
        d="M9.101 13.117C7.694 13.117 6.757 12.531 6.483 11.73C6.439 11.613 6.415 11.486 6.415 11.369C6.415 11.018 6.64 10.793 6.972 10.793C7.25 10.793 7.426 10.905 7.563 11.188C7.782 11.799 8.388 12.072 9.14 12.072C9.989 12.072 10.585 11.652 10.585 11.066C10.585 10.559 10.233 10.246 9.315 10.056L8.559 9.899C7.147 9.611 6.488 8.947 6.488 7.917C6.488 6.677 7.577 5.837 9.105 5.837C10.351 5.837 11.317 6.394 11.605 7.326C11.635 7.404 11.649 7.497 11.649 7.614C11.649 7.922 11.43 8.132 11.102 8.132C10.81 8.132 10.629 8.005 10.497 7.731C10.258 7.136 9.755 6.882 9.096 6.882C8.314 6.882 7.758 7.253 7.758 7.844C7.758 8.322 8.109 8.63 8.988 8.815L9.745 8.972C11.229 9.279 11.854 9.875 11.854 10.92C11.854 12.268 10.795 13.117 9.101 13.117ZM13.632 13.083C13.241 13.083 13.002 12.844 13.002 12.429V6.525C13.002 6.11 13.241 5.871 13.632 5.871C14.027 5.871 14.261 6.11 14.261 6.525V12.429C14.261 12.844 14.027 13.083 13.632 13.083ZM16.332 13.083C15.941 13.083 15.702 12.844 15.702 12.429V6.608C15.702 6.198 15.941 5.954 16.332 5.954H18.441C19.842 5.954 20.814 6.906 20.814 8.313C20.814 9.719 19.813 10.671 18.387 10.671H16.962V12.429C16.962 12.844 16.727 13.083 16.332 13.083ZM16.962 9.655H18.104C19.007 9.655 19.535 9.167 19.535 8.313C19.535 7.468 19.012 6.984 18.109 6.984H16.962V9.655Z"
        fill="#FBFEFE"
      />
    </svg>
  )
}

// ─── close × (currentColor inherits text-text-muted from parent) ──────────────

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 8 8" fill="currentColor">
      <path d="M6.8 7.6L0.4 1.2C0.181 0.981 0.181 0.619 0.4 0.4C0.619 0.181 0.981 0.181 1.2 0.4L7.6 6.8C7.819 7.019 7.819 7.381 7.6 7.6C7.381 7.819 7.019 7.819 6.8 7.6Z" />
      <path d="M0.4 7.6C0.181 7.381 0.181 7.019 0.4 6.8L6.8 0.4C7.019 0.181 7.381 0.181 7.6 0.4C7.819 0.619 7.819 0.981 7.6 1.2L1.2 7.6C0.981 7.819 0.619 7.819 0.4 7.6Z" />
    </svg>
  )
}

// ─── bottle icon ──────────────────────────────────────────────────────────────
// mix-blend-mode:color overlays the user's selected color onto the photographic
// SVG while preserving luminance — keeps the bottle realistic but tinted.

function BottleIcon({ color, type }: { color: string; type: BottleType }) {
  const src = chrome.runtime.getURL(`bottles/${BOTTLE_FILE[type]}`)
  return (
    <div style={{ position: 'relative', width: 24, height: 60, flexShrink: 0, isolation: 'isolate' }}>
      <img
        src={src}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: color,
        mixBlendMode: 'color',
        opacity: 0.55,
        pointerEvents: 'none',
      }} />
    </div>
  )
}
