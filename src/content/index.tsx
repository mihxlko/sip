console.log('SIP content script loaded')

import { createRoot, type Root } from 'react-dom/client'
import { type SipPrefs } from '../types/prefs'
import SipToast from './SipToast'
import toastStyles from './toast.css?inline'

// Animation keyframes live here rather than in toast.css so they don't get
// purged by Tailwind (which only keeps classes it finds in content files).
const ANIMATIONS = `
  @keyframes sip-in  {
    from { opacity: 0; transform: scale(.96) translateY(-4px) }
    to   { opacity: 1; transform: scale(1)   translateY(0)    }
  }
  @keyframes sip-out {
    from { opacity: 1; transform: scale(1)   translateY(0)    }
    to   { opacity: 0; transform: scale(.96) translateY(-4px) }
  }
  .toast     { animation: sip-in  0.22s cubic-bezier(.16,1,.3,1) both; pointer-events: auto; }
  .toast.out { animation: sip-out 0.20s ease-in both; }
  *, *::before, *::after { box-sizing: border-box; }
`

// ─── toast ────────────────────────────────────────────────────────────────────

let toastEl: HTMLElement | null = null
let toastRoot: Root | null = null

function mountToast(prefs: SipPrefs) {
  cleanupToast()

  toastEl = document.createElement('div')
  toastEl.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'pointer-events:none', 'display:flex',
    'align-items:flex-start', 'justify-content:center',
  ].join(';')

  const shadow = toastEl.attachShadow({ mode: 'open' })

  const utilitiesEl = document.createElement('style')
  utilitiesEl.textContent = toastStyles
  shadow.appendChild(utilitiesEl)

  const animEl = document.createElement('style')
  animEl.textContent = ANIMATIONS
  shadow.appendChild(animEl)

  const container = document.createElement('div')
  shadow.appendChild(container)

  document.documentElement.appendChild(toastEl)

  toastRoot = createRoot(container)
  toastRoot.render(<SipToast prefs={prefs} onDismiss={cleanupToast} />)
}

function cleanupToast() {
  toastRoot?.unmount()
  toastEl?.remove()
  toastRoot = null
  toastEl   = null
}

// ─── message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_TOAST') mountToast(msg.prefs as SipPrefs)
})
