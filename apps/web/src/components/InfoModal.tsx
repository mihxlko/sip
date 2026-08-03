'use client'

// Web-only "Info" modal, opened from the top-nav Info link. Header mirrors the
// app/extension top nav (ThemedLogo + gradient wordmark + × close); open/close
// animation follows the shared modal recipe (m-trak design-notes): 160ms in /
// 130ms out, scale 0.94 ↔ 1, easeOutCubic — CSS lives in globals.css.

import { useEffect, useState, type ReactNode } from 'react'
import { ThemedLogo, XIcon } from '@sip/ui'
import { webPlatform } from '../platform'
import { useModalClose } from '../hooks/useModalClose'
import { CHROME_STORE_URL } from '../links'

// Resolved theme for the stacked-logo crossfade: explicit data-theme wins,
// otherwise system preference. Mirrors Settings' resolveIsDark, but tracked
// via observer since the modal doesn't own prefs state.
function useIsDark() {
  const [dark, setDark] = useState(() => {
    const t = document.documentElement.getAttribute('data-theme')
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const html = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const compute = () => {
      const t = html.getAttribute('data-theme')
      setDark(t ? t === 'dark' : mq.matches)
    }
    const mo = new MutationObserver(compute)
    mo.observe(html, { attributes: true, attributeFilter: ['data-theme'] })
    mq.addEventListener('change', compute)
    return () => { mo.disconnect(); mq.removeEventListener('change', compute) }
  }, [])

  return dark
}

// Icon + label + arrow row. Same hover treatment as the top-nav links
// (tertiary → secondary, transition-colors); currentColor lets the icons
// transition in lockstep with the text. href → anchor, else button — same
// no-dead-anchor convention as NavLinks.
function LinkRow({ href, icon, children }: { href?: string; icon: ReactNode; children: string }) {
  const cls = 'cursor-pointer flex items-center gap-2 bg-transparent border-0 p-0 appearance-none outline-none no-underline text-md font-medium text-text-tertiary hover:text-text-secondary transition-colors'
  const content = (
    <>
      {icon}
      <span className="flex items-center gap-0.5">
        {children}
        <ArrowUpRightIcon />
      </span>
    </>
  )
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{content}</a>
    : <button type="button" className={cls}>{content}</button>
}

export default function InfoModal({ onClose }: { onClose: () => void }) {
  const { closing, close } = useModalClose()
  const dark = useIsDark()

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(onClose) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, onClose])

  // No page scroll while the modal is up. <html> is the scroller (body has
  // margin 0, no height); lock it for the modal's lifetime — cleanup restores
  // it after the exit animation unmounts us.
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overflowY
    html.style.overflowY = 'hidden'
    return () => { html.style.overflowY = prev }
  }, [])

  return (
    // onMouseDown (not onClick): a drag that starts inside the panel and
    // releases over the backdrop must not close the modal.
    <div
      className={`info-modal-backdrop${closing ? ' info-modal-backdrop--closing' : ''}`}
      onMouseDown={() => close(onClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About Sip Hydra"
        className={`info-modal${closing ? ' info-modal--closing' : ''} bg-surface-base border-0.5 border-border-default rounded-[24px] p-gap-lg box-border w-[650px] max-w-[calc(100vw-40px)] h-[450px] flex flex-col justify-between overflow-clip`}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── header: brand row identical to the app top nav ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThemedLogo platform={webPlatform} size={24} assetSize={64} dark={dark} />
            <span
              className="font-medium text-transparent bg-clip-text"
              style={{
                fontSize: 14,
                lineHeight: '18px',
                backgroundImage: 'linear-gradient(in oklab 180deg, oklab(75% -0.113 -0.049) 0%, oklab(53.6% -0.009 -0.212) 100%)',
              }}
            >
              Sip Hydra
            </span>
          </div>
          <button
            onClick={() => close(onClose)}
            aria-label="Close"
            className="cursor-pointer text-text-muted hover:text-text-secondary transition-colors bg-transparent border-0 p-0 outline-none leading-none appearance-none flex items-center justify-center w-6 h-6"
          >
            <XIcon size={12} />
          </button>
        </div>

        {/* ── body: about + links ── */}
        <div className="flex flex-col items-start gap-16 self-stretch">
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-md font-medium text-text-secondary">About</span>
            <p className="m-0 self-stretch text-md font-medium text-text-muted">
              I created Sip because I am notoriously bad at remembering to hydrate while
              working on my computer. This Chrome extension helped me fix that, no matter
              how locked in I can get. I hope it can help you out as well.
            </p>
          </div>

          <div className="flex flex-col items-start gap-xs">
            <LinkRow href={CHROME_STORE_URL} icon={<ChromeIcon />}>Download</LinkRow>
            <LinkRow href="https://github.com/mihxlko/sip" icon={<GitHubIcon />}>Code</LinkRow>
          </div>
        </div>

        {/* ── footer ── */}
        <div className="flex items-center justify-between self-stretch">
          <a
            href="https://www.mihalko.us/"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline text-md font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            mihalko.us
          </a>
          <div className="flex items-center gap-2">
            <span className="text-md font-medium text-text-muted">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
            <span className="text-md font-medium text-text-muted">©2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── icons ────────────────────────────────────────────────────────────────────
// currentColor throughout so each row's hover color drives icon + text + arrow.

function ChromeIcon() {
  return (
    <svg viewBox="0.024 8 18 18" width={16} height={16} className="shrink-0" aria-hidden>
      <path d="M12.312 24.773C12.858 23.307 12.374 21.657 11.121 20.719L16.243 20.719C16.747 22.008 16.896 23.407 16.677 24.773L16.774 24.773C17.449 24.773 18.002 24.219 18.002 23.547L18.002 9.229L0.002 9.229L0.002 23.547C0.002 24.222 0.554 24.774 1.228 24.772L1.326 24.772C1.261 24.367 1.229 23.957 1.229 23.547C1.226 22.046 1.66 20.575 2.479 19.317L5.63 24.772L6.476 24.772C6.057 23.9 6.114 22.873 6.626 22.051C7.138 21.23 8.034 20.728 9.002 20.719C9.97 20.728 10.866 21.231 11.377 22.053C11.889 22.875 11.944 23.901 11.525 24.773L12.312 24.773ZM9.002 15.773C11.923 15.772 14.598 17.41 15.926 20.012L9.002 20.012C7.213 20.012 5.705 21.348 5.493 23.125L2.934 18.688C4.407 16.843 6.641 15.771 9.002 15.773M6.955 10.864L11.046 10.864C11.498 10.864 11.864 11.231 11.864 11.682C11.864 12.135 11.498 12.5 11.046 12.5L6.955 12.5C6.504 12.5 6.138 12.135 6.138 11.682C6.138 11.231 6.504 10.864 6.955 10.864" fill="currentColor" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 18 18" width={16} height={16} className="shrink-0" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M0.141 0C0.063 0 0 0.063 0 0.141 0 0.202 0.042 0.256 0.096 0.274 0.105 0.276 0.106 0.272 0.106 0.267 0.106 0.265 0.106 0.254 0.106 0.241 0.071 0.247 0.061 0.232 0.058 0.225 0.058 0.22 0.051 0.209 0.044 0.205 0.04 0.202 0.033 0.196 0.044 0.196 0.056 0.195 0.063 0.205 0.066 0.211 0.078 0.231 0.098 0.225 0.106 0.222 0.107 0.213 0.112 0.206 0.115 0.202 0.085 0.2 0.051 0.187 0.051 0.133 0.051 0.119 0.058 0.105 0.067 0.096 0.066 0.093 0.06 0.078 0.069 0.058 0.069 0.058 0.079 0.056 0.106 0.074 0.117 0.07 0.13 0.067 0.141 0.067 0.153 0.067 0.166 0.07 0.177 0.074 0.204 0.054 0.214 0.058 0.214 0.058 0.223 0.078 0.218 0.093 0.216 0.096 0.225 0.105 0.231 0.119 0.231 0.133 0.231 0.187 0.198 0.2 0.168 0.202 0.173 0.207 0.177 0.215 0.177 0.229 0.177 0.247 0.177 0.263 0.177 0.267 0.177 0.272 0.178 0.276 0.186 0.274 0.241 0.256 0.282 0.202 0.282 0.141 0.282 0.063 0.219 0 0.141 0Z" transform="scale(64)" fill="currentColor" />
    </svg>
  )
}

function ArrowUpRightIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" className="shrink-0" fill="none" aria-hidden>
      <path d="M4.667 4.667h6.667v6.666" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.667 11.333L11.334 4.667" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
