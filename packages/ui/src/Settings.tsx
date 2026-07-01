import { useEffect, useRef, useState } from 'react'
import { Toaster, toast as sonnerToast } from 'sonner'
import NumberFlow from '@number-flow/react'
import {
  BottleColor, BottleType, DEFAULT_PREFS, type SipPlatform, type SipPrefs,
} from '@sip/types'
import SipToast from './SipToast'

// ─── constants ────────────────────────────────────────────────────────────────

const BOTTLE_COLORS: Record<BottleColor, string> = {
  [BottleColor.Red]:    '#E8362D',
  [BottleColor.Orange]: '#F47E47',
  [BottleColor.Yellow]: '#F2CE33',
  [BottleColor.Green]:  '#00B97D',
  [BottleColor.Blue]:   '#5FB2EB',
  [BottleColor.Purple]: '#B938F6',
}

const COLOR_ORDER: BottleColor[] = [
  BottleColor.Red, BottleColor.Orange, BottleColor.Yellow,
  BottleColor.Green, BottleColor.Blue, BottleColor.Purple,
]
const TYPE_ORDER: BottleType[] = [BottleType.Classic, BottleType.Wide, BottleType.Sport]

// ─── helpers ──────────────────────────────────────────────────────────────────

function resolveIsDark(theme: SipPrefs['theme']): boolean {
  if (theme === 'dark')  return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// ─── settings ────────────────────────────────────────────────────────────────

interface Props { platform: SipPlatform; onClose: () => void }

export default function Settings({ platform, onClose }: Props) {
  const [prefs, setPrefsState] = useState<SipPrefs>(DEFAULT_PREFS)
  const [clockInput, setClockInput] = useState('00:15')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const clockTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    platform.getPrefs().then(p => {
      if (live) {
        setPrefsState(p)
        const h = String(Math.floor(p.intervalMinutes / 60)).padStart(2, '0')
        const m = String(p.intervalMinutes % 60).padStart(2, '0')
        setClockInput(`${h}:${m}`)
      }
    })
    return () => { live = false }
  }, [platform])

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
        platform.setPrefs(next)
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
    const raw = e.target.value
    const deleting = raw.length < clockInput.length
    let val = raw.replace(/[^0-9:]/g, '')
    const digits = val.replace(/:/g, '')
    if (!deleting && digits.length >= 2 && !val.includes(':')) {
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
    sonnerToast.custom((id) => (
      <SipToast
        platform={platform}
        prefs={prefs}
        onDismiss={() => sonnerToast.dismiss(id)}
        mode="preview"
      />
    ), { duration: 8000 })
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
    <Toaster
      position="top-right"
      offset="16px"
      visibleToasts={3}
      toastOptions={{ unstyled: true }}
    />
    {/* content root — also the data-theme target for token cascade into children */}
    <div
      ref={modalRef}
      className="relative w-full font-sans antialiased flex flex-col gap-gap-lg bg-surface-base p-gap-lg"
    >

        {/* ── header ── */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between">
          <img src={platform.getIconUrl(32, dark)} width={32} height={32} alt="SIP" style={{ display: 'block' }} />
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
        <div className="bg-surface-primary rounded-xxl shadow border-0.5 border-border-default flex flex-col items-center gap-gap-xl overflow-clip pt-gap-xxl pb-gap-lg">
          <ToastPreview platform={platform} prefs={prefs} dark={dark} />
          {/* Test button: rounded-full = design's 25px radius — no exact token */}
          <button
            onClick={testToast}
            className="btn-press cursor-pointer bg-surface-elevated border-0.5 border-border-emphasis rounded-full shadow-subtle px-gap-md py-xs text-sm font-semibold text-text-secondary appearance-none outline-none hover:bg-[image:linear-gradient(var(--state-hover),var(--state-hover))] hover:text-text-primary"
          >
            Test
          </button>
        </div>

        {/* ── bottom-controls: bottle | bottom-right-controls ── */}
        <div className="flex flex-row gap-gap-lg items-stretch">

          {/* bottle card — flex-1: takes leftover space after the content-sized right column */}
          <div className="flex-1 bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-md">
            <span className="text-text-secondary text-md font-medium px-[8px]">Bottle</span>

            {/* large preview — 250×250 with 50px inner padding */}
            <div
              className="bg-surface-base border-0.5 border-border-default rounded-xl shadow-subtle flex items-center justify-center overflow-clip p-space-padding-xl"
              style={{ width: 250, height: 230 }}
            >
              <img
                src={platform.getBottleUrl(prefs.bottleType, prefs.bottleColor)}
                alt=""
                style={{ height: 200, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </div>

            {/* type thumbnails — 75×75 (1:1) */}
            <div className="flex flex-col gap-gap-md p-pad-md">
              <span className="text-text-muted text-md font-medium px-[2px]">Type</span>
              <div className="flex justify-between">
                {TYPE_ORDER.map(type => (
                  <button
                    key={type}
                    onClick={() => update({ bottleType: type })}
                    className={`cursor-pointer relative overflow-clip rounded-md border-0.5 shadow-subtle flex items-center justify-center appearance-none p-0 outline-none ${
                      prefs.bottleType === type
                        ? 'bg-state-selected border-border-emphasis'
                        : 'bg-surface-base border-border-default'
                    }`}
                    style={{ width: 75, height: 75 }}
                  >
                    <img src={platform.getBottleUrl(type, prefs.bottleColor)} alt={type} style={{ height: 50, width: 'auto', objectFit: 'contain', display: 'block' }} />
                  </button>
                ))}
              </div>
            </div>

            {/* color swatches — 34×34 */}
            <div className="flex flex-col gap-gap-md p-pad-md">
              <span className="text-text-muted text-md font-medium px-[2px]">Color</span>
              <div className="flex justify-between">
                {COLOR_ORDER.map(color => (
                  <button
                    key={color}
                    onClick={() => update({ bottleColor: color })}
                    aria-label={color}
                    className="cursor-pointer overflow-clip shadow-subtle appearance-none p-0 outline-none"
                    style={{
                      width: 34, height: 34,
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: BOTTLE_COLORS[color],
                      outline: prefs.bottleColor === color ? '2px solid var(--border-focus)' : undefined,
                      outlineOffset: prefs.bottleColor === color ? 0.5 : undefined,
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
          <div className="w-full bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-xl">
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
                className="bg-surface-raised border-0.5 border-border-emphasis focus:border-border-focus rounded-lg shadow-subtle px-pad-md py-pad-md text-lg font-semibold text-text-primary outline-none w-full box-border font-sans appearance-none"
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
                className="bg-surface-raised border-0.5 border-border-emphasis focus:border-border-focus rounded-lg shadow-subtle px-pad-md py-pad-md text-lg font-medium text-text-primary outline-none w-full box-border font-sans resize-none"
                style={{ height: 72 }}
              />
            </div>
          </div>

          {/* ── bottom-right-row: time | icon | appearance ── */}
          <div className="flex flex-row gap-gap-lg items-start">

          {/* time card */}
          <div className="flex-1 bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-xl">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Time</span>

            <input
              type="text"
              value={clockInput}
              onChange={handleClockChange}
              onBlur={handleClockBlur}
              onKeyDown={handleClockKeyDown}
              placeholder="HH:MM"
              maxLength={5}
              className="border-0.5 border-border-emphasis focus:border-border-focus rounded-xl px-pad-md py-pad-md text-xl font-semibold text-text-primary leading-tight text-center w-full outline-none bg-surface-raised font-sans appearance-none"
            />

            <div className="flex items-center justify-start gap-xs p-pad-md">
              <span className="text-text-muted text-lg font-medium shrink-0">Every:</span>
              <div className="flex-1 self-stretch rounded-xs shadow-subtle flex items-center gap-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Math.floor(prefs.intervalMinutes / 60) > 0 && (
                  <span className="text-lg font-medium text-text-primary inline-flex items-center">
                    <NumberFlow
                      value={Math.floor(prefs.intervalMinutes / 60)}
                      transformTiming={{ duration: 500, easing: 'cubic-bezier(0.21, 1.02, 0.73, 1)' }}
                      spinTiming={{ duration: 500, easing: 'cubic-bezier(0.21, 1.02, 0.73, 1)' }}
                      opacityTiming={{ duration: 300, easing: 'ease-out' }}
                    />
                    <span className="ml-1">{Math.floor(prefs.intervalMinutes / 60) === 1 ? 'Hour' : 'Hours'}</span>
                  </span>
                )}
                {prefs.intervalMinutes % 60 > 0 && (
                  <span className="text-lg font-medium text-text-primary inline-flex items-center">
                    <NumberFlow
                      value={prefs.intervalMinutes % 60}
                      transformTiming={{ duration: 500, easing: 'cubic-bezier(0.21, 1.02, 0.73, 1)' }}
                      spinTiming={{ duration: 500, easing: 'cubic-bezier(0.21, 1.02, 0.73, 1)' }}
                      opacityTiming={{ duration: 300, easing: 'ease-out' }}
                    />
                    <span className="ml-1">{prefs.intervalMinutes % 60 === 1 ? 'Minute' : 'Minutes'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* icon card — w-[130px]: fixed width, natural content height */}
          <div className="w-[130px] shrink-0 bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-sm">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Icon</span>

            {/* 100×100 preview — no token */}
            <div className="flex flex-col items-center gap-xs">
              <div
                className="border-0.5 border-border-default rounded-xl shadow-subtle flex items-center justify-center bg-surface-base"
                style={{ width: 100, height: 100 }}
              >
                {prefs.customIcon
                  ? <img src={prefs.customIcon} alt="custom" style={{ maxWidth: 63, maxHeight: 63, objectFit: 'contain', display: 'block' }} />
                  : <img src={platform.getIconUrl(64, dark)} width={63} height={63} alt="SIP" style={{ objectFit: 'contain', display: 'block' }} />
                }
              </div>
              <button
                onClick={pickIcon}
                className="cursor-pointer bg-transparent border-0 outline-none appearance-none p-0 text-sm font-medium text-text-tertiary hover:text-text-primary"
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
              <span className="text-sm font-medium text-text-secondary hover:text-text-primary">Show Logo</span>
            </div>
          </div>

          {/* appearance card — w-[130px]: no token, matches popup */}
          <div className="w-[130px] shrink-0 bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-sm">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Appearance</span>

            {/* button group — no chrome; container is just the buttons */}
            <div className="flex flex-col gap-0.5">
              {(['system', 'light', 'dark'] as const).map(theme => (
                <button
                  key={theme}
                  onClick={() => update({ theme })}
                  className={`cursor-pointer flex items-center gap-pad-md rounded-md px-xs py-xs border-0 outline-none appearance-none w-full ${
                    prefs.theme === theme
                      ? 'bg-state-selected text-text-secondary'
                      : 'bg-surface-primary text-text-tertiary hover:bg-state-hover hover:text-text-secondary'
                  }`}
                >
                  <div
                    className={`border rounded-sm shadow-subtle flex items-center justify-center shrink-0 ${
                      prefs.theme === theme
                        ? 'border-border-emphasis'
                        : 'border-border-strong'
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

function ToastPreview({ platform, prefs, dark }: { platform: SipPlatform; prefs: SipPrefs; dark: boolean }) {
  const src = platform.getBottleUrl(prefs.bottleType, prefs.bottleColor)

  return (
    <div className="w-[450px] bg-surface-elevated border-0.5 border-border-emphasis rounded-xl shadow p-pad-xl flex flex-col overflow-clip">

      {/* ── inner row: toast-left + close × ── */}
      <div className="flex gap-gap-xl items-start justify-between">

        {/* toast-left: bottle + main content */}
        <div className="flex flex-1 min-w-0 gap-pad-xl items-start">

          {/* bottle */}
          <div style={{ position: 'relative', width: 24, height: 60, flexShrink: 0, isolation: 'isolate' }}>
            <img
              src={src}
              alt=""
              className="sip-bottle-shimmer"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
            <div
              className="sip-bottle-shimmer-overlay"
              style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
            />
          </div>

          {/* main content */}
          <div className="flex flex-1 min-w-0 flex-col gap-pad-xl">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-pad-sm max-w-full">
                <span className="min-w-0 text-text-primary text-lg font-semibold leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
                  {prefs.titleText || 'Title'}
                </span>
                {prefs.showLogo && (
                  <div className="shrink-0">
                    {prefs.customIcon
                      ? <img src={prefs.customIcon} width={28} height={18} className="block rounded-md object-cover" />
                      : <img src={platform.getIconUrl(32, dark)} width={16} height={16} alt="SIP" style={{ display: 'block', borderRadius: 4 }} />
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
