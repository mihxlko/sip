import { useEffect, useState } from 'react'
import { type BottleColor, type BottleType, type SipPlatform, type SipPrefs } from '@sip/types'

// ─── constants ───────────────────────────────────────────────────────────────

const DISMISS_MS = 8_000
const FADE_MS    = 200

// ─── component ───────────────────────────────────────────────────────────────

interface Props { platform: SipPlatform; prefs: SipPrefs; onDismiss: () => void; mode?: 'live' | 'preview' }

export default function SipToast({ platform, prefs, onDismiss, mode = 'live' }: Props) {
  const [out, setOut] = useState(false)

  // In 'preview' mode Sonner owns both the auto-dismiss timer (via the
  // `duration` option) and the enter/exit animation, so the manual
  // fade-then-remove dance below is 'live'-only — running it in preview
  // would double-animate against Sonner's own exit transition.
  useEffect(() => {
    if (mode === 'preview') return
    const fade   = setTimeout(() => setOut(true), DISMISS_MS - FADE_MS)
    const remove = setTimeout(onDismiss,           DISMISS_MS)
    return () => { clearTimeout(fade); clearTimeout(remove) }
  }, [onDismiss, mode])

  function dismiss() {
    if (mode === 'preview') { onDismiss(); return }
    setOut(true)
    setTimeout(onDismiss, FADE_MS)
  }

  function openPrefs() {
    if (mode === 'preview') return
    platform.openSettings()
    dismiss()
  }

  return (
    <div className={mode === 'preview' ? 'sip-toast' : `${out ? 'toast out' : 'toast'} sip-toast`}>

      {/* ── inner row: toast-left + close × ── */}
      <div className="sip-toast-row">

        {/* toast-left: bottle + main content */}
        <div className="sip-toast-left">

          {/* bottle */}
          <BottleIcon platform={platform} type={prefs.bottleType} color={prefs.bottleColor} />

          {/* main content */}
          <div className="sip-toast-content">

            {/* header */}
            <div className="sip-toast-header">

              {/* title row — max-w matches the message width so a long title
                  can't push main-content wider than the 350px message */}
              {/* v2 dropped the logo badge that used to sit beside the title.
                  Removed here and not just in Settings' preview: Test fires this
                  very component top-right while the preview sits alongside it,
                  so any difference between the two is immediately visible. */}
              <div className="sip-toast-title-row">
                <span className="sip-toast-title">
                  {prefs.titleText}
                </span>
              </div>

              {/* message — 350px fixed (outdated); drives the toast's overall width */}
              <p className="sip-toast-message">
                {prefs.messageText}
              </p>
            </div>

            {/* edit preferences */}
            <button
              onClick={openPrefs}
              className="sip-toast-edit"
            >
              Edit preferences
            </button>
          </div>
        </div>

        {/* close × */}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="sip-toast-close"
        >
          <XIcon />
        </button>
      </div>
    </div>
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
// The tint comes from the asset itself — getBottleUrl resolves to a per-color
// SVG — so this renders flat, with no animation or blend layer over it.

function BottleIcon({ platform, type, color }: { platform: SipPlatform; type: BottleType; color: BottleColor }) {
  return (
    <img
      src={platform.getBottleUrl(type, color)}
      alt=""
      style={{ width: 24, height: 60, flexShrink: 0, objectFit: 'contain', display: 'block' }}
    />
  )
}
