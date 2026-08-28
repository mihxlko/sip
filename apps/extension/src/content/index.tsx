console.log('SIP content script loaded')

import { createRoot, type Root } from 'react-dom/client'
import { type SipPrefs } from '@sip/types'
import { SipToast } from '@sip/ui'
import toastStyles from '@sip/ui/toast-styles.css?inline'
import { chromePlatform } from '../platform'

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
