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
  // Anchored on BOTH sides, not just the right. The host is the full gutter-to-
  // gutter band and the toast right-aligns inside it, so above 482px it sits
  // top-right at 450px and below that it fills the band instead of overflowing
  // the viewport — which is what a right-only anchor did.
  //
  // env() only resolves to a real inset when the host page opts in with
  // viewport-fit=cover, which most pages do not; max() makes it a no-op at 16px
  // everywhere else. It costs nothing and it is correct on the pages that do.
  toastEl.style.cssText = [
    'position:fixed',
    'top:max(16px, env(safe-area-inset-top))',
    'left:max(16px, env(safe-area-inset-left))',
    'right:max(16px, env(safe-area-inset-right))',
    'z-index:2147483647', 'pointer-events:none',
  ].join(';')
  toastEl.setAttribute('data-theme', resolveTheme(prefs.theme))

  // WCAG 4.1.3 Status Messages. The toast appears without taking focus, so
  // with no live region a screen reader user is told nothing at all — it is
  // simply invisible to them. Settings' Test button never had this problem
  // because Sonner wraps its own toasts in an aria-live region, so the two
  // surfaces behaved differently and only one of them was wrong.
  //
  // role="status" already implies aria-live="polite" and aria-atomic="true".
  // Both are spelled out anyway: older screen readers do not reliably infer
  // them, and atomic is what makes the toast read as one announcement rather
  // than title, message and button as three fragments.
  //
  // On the HOST, in the light DOM — not on a node inside the shadow root. The
  // shadow content flattens into the host's subtree in the accessibility tree,
  // so a region declared out here covers it without depending on assistive
  // tech tracking live regions across a shadow boundary.
  toastEl.setAttribute('role', 'status')
  toastEl.setAttribute('aria-live', 'polite')
  toastEl.setAttribute('aria-atomic', 'true')

  const shadow = toastEl.attachShadow({ mode: 'open' })

  const styleEl = document.createElement('style')
  styleEl.textContent = toastStyles
  shadow.appendChild(styleEl)

  // Alignment is a class, not an inline style: .sip-toast-host carries a media
  // query that centres the toast once the UI stacks, and an inline style would
  // win over it. The class lives in the shared sheet; the Settings preview
  // never uses it, so its scope stays centred by its own pane.
  const container = document.createElement('div')
  container.className = 'sip-toast-host'
  shadow.appendChild(container)

  // Order is load-bearing for the live region above: announcements fire on
  // mutation, so the host has to be in the document and EMPTY before the toast
  // content lands. A region that arrives already populated announces nothing.
  // createRoot().render() commits in a later task, which is what opens that
  // gap — verified rather than assumed.
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
