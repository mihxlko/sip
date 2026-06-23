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
