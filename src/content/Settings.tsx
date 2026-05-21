import { useEffect, useRef, useState } from 'react'
import {
  BottleColor, BottleType, DEFAULT_PREFS, getPrefs,
  setPrefs as persistPrefs, type SipPrefs,
} from '../types/prefs'
import SipToast from './SipToast'

// ─── constants ────────────────────────────────────────────────────────────────

const BOTTLE_COLORS: Record<BottleColor, string> = {
  [BottleColor.Pink]:   '#FC7792',
  [BottleColor.Orange]: '#F47E47',
  [BottleColor.Yellow]: '#F2CE33',
  [BottleColor.Green]:  '#00B97D',
  [BottleColor.Blue]:   '#5FB2EB',
  [BottleColor.Purple]: '#B938F6',
}

const BOTTLE_FILES: Record<BottleType, string> = {
  [BottleType.Classic]: 'yetti.svg',
  [BottleType.Wide]:    'bibs.svg',
  [BottleType.Sport]:   'camelbak.svg',
}

const COLOR_ORDER: BottleColor[] = [
  BottleColor.Pink, BottleColor.Orange, BottleColor.Yellow,
  BottleColor.Green, BottleColor.Blue,  BottleColor.Purple,
]
const TYPE_ORDER: BottleType[] = [BottleType.Classic, BottleType.Wide, BottleType.Sport]

// ─── helpers ──────────────────────────────────────────────────────────────────

function bottleSrc(type: BottleType) {
  return chrome.runtime.getURL(`bottles/${BOTTLE_FILES[type]}`)
}

function resolveIsDark(theme: SipPrefs['theme']): boolean {
  if (theme === 'dark')  return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function fmtInterval(m: number): string {
  const h = Math.floor(m / 60)
  const r = m % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} Hour${h !== 1 ? 's' : ''}`)
  if (r > 0) parts.push(`${r} Minute${r !== 1 ? 's' : ''}`)
  return parts.join(' ') || '5 Minutes'
}

// ─── settings ────────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

export default function Settings({ onClose }: Props) {
  const [prefs, setPrefsState] = useState<SipPrefs>(DEFAULT_PREFS)
  const [clockInput, setClockInput] = useState('00:15')
  const [showTestToast, setShowTestToast] = useState(false)
  const [toastKey, setToastKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const clockTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    getPrefs().then(p => {
      if (live) {
        setPrefsState(p)
        const h = String(Math.floor(p.intervalMinutes / 60)).padStart(2, '0')
        const m = String(p.intervalMinutes % 60).padStart(2, '0')
        setClockInput(`${h}:${m}`)
      }
    })
    return () => { live = false }
  }, [])

  // Apply data-theme to the modal div so [data-theme="dark"] in tokens.css
  // cascades into the shadow tree. Note: explicit 'light' on a dark-OS system
  // will still show dark (shadow :root always gets the media-query dark vars).
  useEffect(() => {
    if (!modalRef.current) return
    if (prefs.theme === 'dark') modalRef.current.setAttribute('data-theme', 'dark')
    else modalRef.current.removeAttribute('data-theme')
  }, [prefs.theme])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function update(patch: Partial<SipPrefs>) {
    setPrefsState(prev => {
      const next = { ...prev, ...patch }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        persistPrefs(next).then(() =>
          chrome.runtime.sendMessage({ type: 'UPDATE_ALARM', payload: next })
        )
      }, 400)
      return next
    })
  }

  function parseClockInput(s: string): number | null {
    const match = s.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return null
    const h = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    if (h > 24 || m > 59) return null
    if (h === 24 && m !== 0) return null
    const total = h * 60 + m
    if (total < 1 || total > 1440) return null
    return total
  }

  function handleClockChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/[^0-9:]/g, '')
    const digits = val.replace(/:/g, '')
    if (digits.length >= 2 && !val.includes(':')) {
      val = digits.slice(0, 2) + ':' + digits.slice(2)
    }
    val = val.slice(0, 5)
    setClockInput(val)

    clearTimeout(clockTimerRef.current)
    clockTimerRef.current = setTimeout(() => {
      const mins = parseClockInput(val)
      if (mins !== null) update({ intervalMinutes: mins })
    }, 500)
  }

  function handleClockBlur() {
    clearTimeout(clockTimerRef.current)
    const mins = parseClockInput(clockInput)
    if (mins !== null) {
      update({ intervalMinutes: mins })
    } else {
      const h = String(Math.floor(prefs.intervalMinutes / 60)).padStart(2, '0')
      const m = String(prefs.intervalMinutes % 60).padStart(2, '0')
      setClockInput(`${h}:${m}`)
    }
  }

  function handleClockKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  function testToast() {
    setToastKey(k => k + 1)
    setShowTestToast(true)
  }

  function pickIcon() {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.onchange = () => {
      const file = inp.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => update({ customIcon: reader.result as string })
      reader.readAsDataURL(file)
    }
    inp.click()
  }

  const dark  = resolveIsDark(prefs.theme)

  return (
    <>
    {showTestToast && (
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}>
        <SipToast key={toastKey} prefs={prefs} onDismiss={() => setShowTestToast(false)} mode="preview" />
      </div>
    )}
    {/* content root — also the data-theme target for token cascade into children */}
    <div
      ref={modalRef}
      className="w-full font-sans antialiased flex flex-col gap-gap-lg"
    >

        {/* ── header ── */}
        <div className="flex items-start justify-between">
          <SipBadge width={39} gradId="sip-ov-hdr" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-text-muted bg-transparent border-0 p-0 outline-none leading-none appearance-none"
          >
            <XIcon size={15} />
          </button>
        </div>

        {/* ── settings-controls: preview + bottom-controls ── */}
        <div className="w-full max-w-[850px] mx-auto flex flex-col gap-gap-lg">

        {/* ── preview panel ── */}
        <div className="bg-surface-elevated rounded-lg shadow border-0.5 border-border-default flex flex-col items-center gap-gap-xl overflow-clip pt-gap-xxl pb-gap-lg">
          <ToastPreview prefs={prefs} dark={dark} />
          {/* Test button: rounded-full = design's 25px radius — no exact token */}
          <button
            onClick={testToast}
            className="cursor-pointer bg-surface-elevated border-0.5 border-border-default rounded-full shadow-subtle px-gap-md py-xs text-sm font-semibold text-text-secondary appearance-none outline-none hover:bg-state-hover hover:text-text-primary"
          >
            Test
          </button>
        </div>

        {/* ── bottom-controls: bottle | bottom-right-controls ── */}
        <div className="flex flex-row gap-gap-lg items-stretch">

          {/* bottle card — flex-1: takes leftover space after the content-sized right column */}
          <div className="flex-1 bg-surface-elevated rounded-lg shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-md">
            <span className="text-text-secondary text-md font-medium px-[2px]">Bottle</span>

            {/* large preview — 250×250 with 50px inner padding */}
            <div
              className="bg-surface-elevated border-0.5 border-border-default rounded-md shadow-subtle flex items-center justify-center overflow-clip p-pad-xxl"
              style={{ width: 250, height: 250 }}
            >
              <img
                src={bottleSrc(prefs.bottleType)}
                alt=""
                style={{ height: 130, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </div>

            {/* type thumbnails — 75×75 (1:1) */}
            <div className="flex flex-col gap-gap-md">
              <span className="text-text-muted text-md font-medium px-[2px]">Type</span>
              <div className="flex justify-between">
                {TYPE_ORDER.map(type => (
                  <button
                    key={type}
                    onClick={() => update({ bottleType: type })}
                    className={`cursor-pointer relative overflow-clip rounded-md border-0.5 shadow-subtle flex items-center justify-center appearance-none p-0 outline-none ${
                      prefs.bottleType === type
                        ? 'bg-surface-base border-border-strong'
                        : 'bg-surface-elevated border-border-default'
                    }`}
                    style={{ width: 75, height: 75 }}
                  >
                    <img src={bottleSrc(type)} alt={type} style={{ height: 50, width: 'auto', objectFit: 'contain', display: 'block' }} />
                  </button>
                ))}
              </div>
            </div>

            {/* color swatches — 38×38 */}
            <div className="flex flex-col gap-gap-md">
              <span className="text-text-muted text-md font-medium px-[2px]">Color</span>
              <div className="flex justify-between">
                {COLOR_ORDER.map(color => (
                  <button
                    key={color}
                    onClick={() => update({ bottleColor: color })}
                    aria-label={color}
                    className="cursor-pointer overflow-clip rounded-md shadow-subtle appearance-none p-0 outline-none"
                    style={{
                      width: 38, height: 38,
                      backgroundColor: BOTTLE_COLORS[color],
                      outline: prefs.bottleColor === color ? '2px solid var(--border-strong)' : undefined,
                      outlineOffset: prefs.bottleColor === color ? 2 : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* bottom-right-controls: text-card on top, bottom-right-row below.
              Content-sized width (no flex-1) so bottle takes the leftover.
              justify-between distributes any extra height (from items-stretch on
              the outer row) between the two children. */}
          <div className="flex flex-col gap-gap-lg justify-between">

          {/* text card */}
          <div className="w-full bg-surface-elevated rounded-lg shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-xl">
            <span className="text-text-secondary text-md font-medium px-[8px]">Text</span>

            <div className="flex flex-col gap-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-md font-medium pl-[8px]">Title</span>
                <span className={`${prefs.titleText.length >= 35 ? 'text-text-error' : 'text-text-muted'} text-md font-medium pr-[8px]`}>{prefs.titleText.length}/40 Characters</span>
              </div>
              {/* rounded-xs (4px) ≈ design's 5px — 1px deviation, no 5px radius token */}
              <input
                type="text"
                value={prefs.titleText}
                maxLength={40}
                onChange={e => update({ titleText: e.target.value })}
                className="bg-surface-elevated border-0.5 border-border-default rounded-xs shadow-subtle px-pad-md py-pad-md text-lg font-semibold text-text-primary outline-none w-full box-border font-sans appearance-none focus:border-1.5 focus:border-border-focus"
              />
            </div>

            <div className="flex flex-col gap-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-md font-medium pl-[8px]">Message</span>
                <span className={`${prefs.messageText.length >= 55 ? 'text-text-error' : 'text-text-muted'} text-md font-medium pr-[8px]`}>{prefs.messageText.length}/60 Characters</span>
              </div>
              {/* height:72px: no token */}
              <textarea
                value={prefs.messageText}
                maxLength={60}
                onChange={e => update({ messageText: e.target.value })}
                className="bg-surface-elevated border-0.5 border-border-default rounded-xs shadow-subtle px-pad-md py-pad-md text-lg font-medium text-text-primary outline-none w-full box-border font-sans resize-none focus:border-1.5 focus:border-border-focus"
                style={{ height: 72 }}
              />
            </div>
          </div>

          {/* ── bottom-right-row: time | icon | appearance ── */}
          <div className="flex flex-row gap-gap-lg items-start">

          {/* time card */}
          <div className="flex-1 bg-surface-elevated rounded-lg shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-xl">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Time</span>

            <input
              type="text"
              value={clockInput}
              onChange={handleClockChange}
              onBlur={handleClockBlur}
              onKeyDown={handleClockKeyDown}
              placeholder="HH:MM"
              maxLength={5}
              className="border-0.5 border-border-default rounded-sm shadow-subtle px-pad-md py-pad-md text-xl font-semibold text-text-primary leading-tight text-center w-full outline-none bg-transparent font-sans appearance-none focus:border-1.5 focus:border-border-focus"
            />

            <div className="flex items-center justify-start gap-xs p-pad-md">
              <span className="text-text-muted text-md font-medium shrink-0">Every:</span>
              <div className="flex-1 self-stretch bg-surface-base border-0.5 border-border-default rounded-xs shadow-subtle px-pad-md py-xs flex items-center">
                <span className="text-md font-medium text-text-primary">{fmtInterval(prefs.intervalMinutes)}</span>
              </div>
            </div>
          </div>

          {/* icon card — w-[130px]: fixed width, natural content height */}
          <div className="w-[130px] shrink-0 bg-surface-elevated rounded-lg shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-sm">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Icon</span>

            {/* 100×100 preview — no token */}
            <div className="flex flex-col items-center gap-xs">
              <div
                className="border-0.5 border-border-default rounded-md shadow-subtle flex items-center justify-center bg-surface-elevated"
                style={{ width: 100, height: 100 }}
              >
                {prefs.customIcon
                  ? <img src={prefs.customIcon} alt="custom" style={{ maxWidth: 63, maxHeight: 63, objectFit: 'contain', display: 'block' }} />
                  : <SipBadge width={63} gradId="sip-ov-icon" />
                }
              </div>
              <button
                onClick={pickIcon}
                className="cursor-pointer bg-transparent border-0 outline-none appearance-none rounded-xl px-pad-md py-xs text-sm font-medium text-text-secondary hover:bg-state-hover hover:text-text-primary"
              >
                Upload Custom
              </button>
            </div>

            {/* show logo — checkbox 18×18: no token */}
            <div
              className="flex items-center gap-pad-md cursor-pointer select-none"
              role="checkbox"
              aria-checked={prefs.showLogo}
              tabIndex={0}
              onClick={() => update({ showLogo: !prefs.showLogo })}
              onKeyDown={e => e.key === ' ' && update({ showLogo: !prefs.showLogo })}
            >
              <div
                className="border-0.5 border-border-default rounded-xs shadow-subtle flex items-center justify-center shrink-0 overflow-clip bg-surface-elevated"
                style={{ width: 18, height: 18 }}
              >
                {prefs.showLogo && (
                  <span className="text-text-primary">
                    <CheckIcon />
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-text-primary">Show Logo</span>
            </div>
          </div>

          {/* appearance card — w-[130px]: no token, matches popup */}
          <div className="w-[130px] shrink-0 bg-surface-elevated rounded-lg shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-sm">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Appearance</span>

            {/* icon container 25×25: no token */}
            <div className="border-0.5 border-border-default rounded-md shadow-subtle flex flex-col gap-xs p-xs">
              {(['system', 'light', 'dark'] as const).map(theme => (
                <button
                  key={theme}
                  onClick={() => update({ theme })}
                  className={`group cursor-pointer flex items-center gap-pad-md rounded-md px-xs py-xs border-0 outline-none appearance-none w-full ${
                    prefs.theme === theme
                      ? 'bg-state-selected text-text-secondary'
                      : 'bg-transparent text-text-tertiary hover:bg-state-hover hover:text-text-secondary'
                  }`}
                >
                  <div
                    className={`border-0.5 rounded-sm shadow-subtle flex items-center justify-center shrink-0 ${
                      prefs.theme === theme
                        ? 'bg-state-selected border-border-strong'
                        : 'bg-surface-elevated border-border-default group-hover:bg-state-hover'
                    }`}
                    style={{ width: 25, height: 25 }}
                  >
                    <ThemeIcon theme={theme} />
                  </div>
                  <span className="text-sm font-medium text-left">
                    {theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          </div>{/* /bottom-right-row */}
          </div>{/* /bottom-right-controls */}
        </div>{/* /bottom-controls */}
        </div>{/* /settings-controls */}
    </div>
    </>
  )
}

// ─── toast preview (visual-only, no dismiss logic) ────────────────────────────

function ToastPreview({ prefs, dark }: { prefs: SipPrefs; dark: boolean }) {
  const bottleColor = BOTTLE_COLORS[prefs.bottleColor]
  const src = bottleSrc(prefs.bottleType)

  return (
    <div className="w-[450px] bg-surface-elevated border-0.5 border-border-default rounded-xl shadow p-pad-xl flex flex-col overflow-clip">

      {/* ── inner row: toast-left + close × ── */}
      <div className="flex gap-gap-xl items-start justify-between">

        {/* toast-left: bottle + main content */}
        <div className="flex flex-1 min-w-0 gap-pad-xl items-start">

          {/* bottle with color tint */}
          <div style={{ position: 'relative', width: 24, height: 60, flexShrink: 0, isolation: 'isolate' }}>
            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundColor: bottleColor, mixBlendMode: 'color', opacity: 0.55, pointerEvents: 'none' }} />
          </div>

          {/* main content */}
          <div className="flex flex-1 min-w-0 flex-col gap-pad-xl">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-pad-sm max-w-full">
                <span className="min-w-0 text-text-primary text-lg font-semibold leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
                  {prefs.titleText || 'Title'}
                </span>
                {prefs.showLogo && (
                  <div className="shrink-0 mb-0.5">
                    {prefs.customIcon
                      ? <img src={prefs.customIcon} width={28} height={18} className="block rounded-md object-cover" />
                      : <SipBadge width={28} gradId="sip-ov-prev" dark={dark} />
                    }
                  </div>
                )}
              </div>
              <p className="m-0 text-text-muted text-sm font-medium leading-[16px]">
                {prefs.messageText || 'Message'}
              </p>
            </div>
            <span className="text-text-brand text-sm font-medium leading-[16px]">Edit preferences</span>
          </div>
        </div>

        {/* close × */}
        <span className="shrink-0 text-text-muted p-xs leading-none">
          <XIcon size={10} />
        </span>
      </div>
    </div>
  )
}

// ─── SIP badge ────────────────────────────────────────────────────────────────

function SipBadge({ width = 28, gradId, dark = false }: { width?: number; gradId: string; dark?: boolean }) {
  if (dark) {
    return (
      <div style={{ backgroundColor: '#5FB2EB', borderRadius: 8, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ color: '#E4F7FB', fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' }}>SIP</span>
      </div>
    )
  }
  const height = Math.round(width * (18 / 28))
  return (
    <svg width={width} height={height} viewBox="0 0 28 18" fill="none">
      <defs>
        <linearGradient id={gradId} x1="14" y1="0" x2="14" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#79D4EE" />
          <stop offset="1" stopColor="#51A0EA" />
        </linearGradient>
      </defs>
      <rect width="28" height="18" rx="8" fill={`url(#${gradId})`} />
      <path d="M9.101 13.117C7.694 13.117 6.757 12.531 6.483 11.73C6.439 11.613 6.415 11.486 6.415 11.369C6.415 11.018 6.64 10.793 6.972 10.793C7.25 10.793 7.426 10.905 7.563 11.188C7.782 11.799 8.388 12.072 9.14 12.072C9.989 12.072 10.585 11.652 10.585 11.066C10.585 10.559 10.233 10.246 9.315 10.056L8.559 9.899C7.147 9.611 6.488 8.947 6.488 7.917C6.488 6.677 7.577 5.837 9.105 5.837C10.351 5.837 11.317 6.394 11.605 7.326C11.635 7.404 11.649 7.497 11.649 7.614C11.649 7.922 11.43 8.132 11.102 8.132C10.81 8.132 10.629 8.005 10.497 7.731C10.258 7.136 9.755 6.882 9.096 6.882C8.314 6.882 7.758 7.253 7.758 7.844C7.758 8.322 8.109 8.63 8.988 8.815L9.745 8.972C11.229 9.279 11.854 9.875 11.854 10.92C11.854 12.268 10.795 13.117 9.101 13.117ZM13.632 13.083C13.241 13.083 13.002 12.844 13.002 12.429V6.525C13.002 6.11 13.241 5.871 13.632 5.871C14.027 5.871 14.261 6.11 14.261 6.525V12.429C14.261 12.844 14.027 13.083 13.632 13.083ZM16.332 13.083C15.941 13.083 15.702 12.844 15.702 12.429V6.608C15.702 6.198 15.941 5.954 16.332 5.954H18.441C19.842 5.954 20.814 6.906 20.814 8.313C20.814 9.719 19.813 10.671 18.387 10.671H16.962V12.429C16.962 12.844 16.727 13.083 16.332 13.083ZM16.962 9.655H18.104C19.007 9.655 19.535 9.167 19.535 8.313C19.535 7.468 19.012 6.984 18.109 6.984H16.962V9.655Z" fill="#FBFEFE" />
    </svg>
  )
}

// ─── icons ────────────────────────────────────────────────────────────────────

function XIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="currentColor">
      <path d="M6.8 7.6L0.4 1.2C0.181 0.981 0.181 0.619 0.4 0.4C0.619 0.181 0.981 0.181 1.2 0.4L7.6 6.8C7.819 7.019 7.819 7.381 7.6 7.6C7.381 7.819 7.019 7.819 6.8 7.6Z" />
      <path d="M0.4 7.6C0.181 7.381 0.181 7.019 0.4 6.8L6.8 0.4C7.019 0.181 7.381 0.181 7.6 0.4C7.819 0.619 7.819 0.981 7.6 1.2L1.2 7.6C0.981 7.819 0.619 7.819 0.4 7.6Z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.86 18a1 1 0 0 1-.73-.32l-4.86-5.17a1 1 0 1 1 1.46-1.37l4.12 4.39 8.41-9.2a1 1 0 1 1 1.48 1.34l-9.14 10a1 1 0 0 1-.73.33z" />
    </svg>
  )
}

function ThemeIcon({ theme }: { theme: 'system' | 'light' | 'dark' }) {
  // stroke=currentColor lets the parent button's text color drive the icon,
  // so inactive/hover/active states are controlled in one place.
  if (theme === 'system') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M21 7V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V7C3 4 4.5 2 8 2H16C19.5 2 21 4 21 7Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.25 11H7.75C6.79 11 6 10.21 6 9.25V6.75C6 5.79 6.79 5 7.75 5H16.25C17.21 5 18 5.79 18 6.75V9.25C18 10.21 17.21 11 16.25 11Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.3 15.28L8 17.58M8.03 15.31L10.33 17.61" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.49 15.33H16.51M14.49 17.5V17.48" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (theme === 'light') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M12 18.5C15.59 18.5 18.5 15.59 18.5 12C18.5 8.41 15.59 5.5 12 5.5C8.41 5.5 5.5 8.41 5.5 12C5.5 15.59 8.41 18.5 12 18.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19.14 19.14L19.01 19.01M19.01 4.99L19.14 4.86M4.86 19.14L4.99 19.01M12 2.08V2M12 22V21.92M2.08 12H2M22 12H21.92M4.99 4.99L4.86 4.86" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="15" height="15" viewBox="0 0 21 22" fill="none">
      <path d="M0.777 11.175C1.137 16.325 5.507 20.515 10.737 20.745C14.427 20.905 17.727 19.185 19.707 16.475C20.527 15.365 20.087 14.625 18.717 14.875C18.047 14.995 17.357 15.045 16.637 15.015C11.747 14.815 7.747 10.725 7.727 5.895C7.717 4.595 7.987 3.365 8.477 2.245C9.017 1.005 8.367 0.415 7.117 0.945C3.157 2.615 0.447 6.605 0.777 11.175Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
