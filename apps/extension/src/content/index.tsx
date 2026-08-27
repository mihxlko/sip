console.log('SIP content script loaded')

import { createRoot, type Root } from 'react-dom/client'
import { type SipPrefs } from '@sip/types'
import { SipToast } from '@sip/ui'
import toastStyles from '@sip/ui/toast-styles.css?inline'
import { chromePlatform } from '../platform'

// ─── typeface ─────────────────────────────────────────────────────────────────
// The toast is the one surface that cannot get SF Pro Rounded from the
// @font-face rules in tokens.css, for two independent reasons: font faces
// declared inside a shadow root are ignored (they are document-scoped), and the
// `/fonts/…` URL in that sheet would resolve against whatever site the toast is
// injected into. So register the same three files on the HOST document, with
// extension-absolute URLs. Font faces added to document.fonts are visible
// inside the shadow root, which is what makes this work at all.
//
// Registration is idempotent and deliberately not awaited: font-display:swap
// equivalent behaviour is automatic here, so the toast paints immediately in
// the ui-rounded fallback and upgrades in place when the woff2 lands.
const FONT_WEIGHTS = [
  ['400', 'SF-Pro-Rounded-Regular.woff2'],
  ['500', 'SF-Pro-Rounded-Medium.woff2'],
  ['600', 'SF-Pro-Rounded-Semibold.woff2'],
] as const

let fontsRegistered = false

function registerToastFonts() {
  if (fontsRegistered) return
  fontsRegistered = true
  for (const [weight, file] of FONT_WEIGHTS) {
    try {
      const face = new FontFace(
        'SF Pro Rounded',
        `url(${chrome.runtime.getURL(`fonts/${file}`)})`,
        { weight, style: 'normal', display: 'swap' },
      )
      face.load().then(f => document.fonts.add(f)).catch(() => {
        /* host CSP can block extension font URLs; the ui-rounded fallback holds */
      })
    } catch {
      /* FontFace unavailable — fallback stack holds */
    }
  }
}

// ─── toast ────────────────────────────────────────────────────────────────────

let toastEl: HTMLElement | null = null
let toastRoot: Root | null = null

function resolveTheme(theme: SipPrefs['theme']): 'dark' | 'light' {
  if (theme === 'dark') return 'dark'
  if (theme === 'light') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function mountToast(prefs: SipPrefs) {
  cleanupToast()
  registerToastFonts()

  toastEl = document.createElement('div')
  toastEl.style.cssText = [
    'position:fixed', 'top:16px', 'right:16px',
    'z-index:2147483647', 'pointer-events:none',
  ].join(';')
  toastEl.setAttribute('data-theme', resolveTheme(prefs.theme))

  const shadow = toastEl.attachShadow({ mode: 'open' })

  const styleEl = document.createElement('style')
  styleEl.textContent = toastStyles
  shadow.appendChild(styleEl)

  const container = document.createElement('div')
  shadow.appendChild(container)

  document.documentElement.appendChild(toastEl)

  toastRoot = createRoot(container)
  toastRoot.render(<SipToast platform={chromePlatform} prefs={prefs} onDismiss={cleanupToast} />)
}

function cleanupToast() {
  toastRoot?.unmount()
  toastEl?.remove()
  toastRoot = null
  toastEl   = null
}

// ─── message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_TOAST') {
    if (window.location.protocol === 'chrome-extension:') return
    mountToast(msg.prefs as SipPrefs)
  }
})
