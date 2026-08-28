import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Toaster, toast as sonnerToast } from 'sonner'
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

// "1 Hour 30 Minutes" / "15 Minutes" / "2 Hours". Singular/plural per unit, and
// a zero unit is dropped entirely rather than printed as "0 Hours".
function intervalWords(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  const parts: string[] = []
  if (h) parts.push(`${h} ${h === 1 ? 'Hour' : 'Hours'}`)
  if (m) parts.push(`${m} ${m === 1 ? 'Minute' : 'Minutes'}`)
  return parts.join(' ') || '0 Minutes'
}

// ─── settings ────────────────────────────────────────────────────────────────

// headerRight replaces the default close button on the header's right side —
// the web app injects its nav links there; the extension omits it and keeps ×.
interface Props { platform: SipPlatform; onClose: () => void; headerRight?: ReactNode }

export default function Settings({ platform, onClose, headerRight }: Props) {
  const [prefs, setPrefsState] = useState<SipPrefs>(DEFAULT_PREFS)
  const [clockInput, setClockInput] = useState('00:15')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const clockTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const clockRef = useRef<HTMLInputElement>(null)
  const clockCaretRef = useRef<number | null>(null)
  // Arms the theme-transition CSS for the next data-theme flip. Set only by an
  // explicit user pick (changeTheme), so load/getPrefs never animates.
  const themeAnimRef = useRef(false)
  const themeTransTimer = useRef<ReturnType<typeof setTimeout>>()
  // Test fires a real toast through Sonner, so it has to move where the live
  // toast moves. .sip-toast-host does that in CSS for the extension; Sonner
  // owns its own positioning, so here it takes a prop. Same 659 as the `narrow`
  // screen in tailwind.config.ts and the media query in toast-styles.css.
  const [stacked, setStacked] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 659px)')
    const sync = () => setStacked(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

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

  // Apply the theme on <html> — the single theme root for the settings page
  // (main.tsx / page.tsx also drive var(--surface-base) on <html>). Doing it here
  // too, synchronously on the state change, is what makes the switch immediate and
  // animated: the debounced setPrefs → onPrefsChanged path re-applies the same
  // value ~400ms later as a no-op. Set the explicit theme ('light' must be a real
  // attribute, not just "not dark"); remove it for 'system' so the media query wins.
  //
  // When a user pick armed themeAnimRef, add data-theme-transitioning in the SAME
  // update as the data-theme flip (per the CSS transitions spec, transition-property
  // is read from the after-change style, so this animates without a forced reflow),
  // then strip it on a timer so the gated rule only exists during the window. It
  // lives on <html> so the gated transition covers the page background and every
  // card/border/shadow beneath it — not just the modal subtree.
  //
  // useLayoutEffect (not useEffect) is load-bearing: the clicked Appearance button
  // also changes color via a React className swap (it gains bg-state-selected in the
  // same render). A passive effect would flip <html>/arm one paint LATER, so the
  // button's selection change would land unarmed in the prior paint and snap out of
  // sync. Running synchronously before paint collapses the className swap, the theme
  // flip, and the arming into one armed style update — so the button animates in
  // lockstep with every card. ("Both land in the same style update.")
  useLayoutEffect(() => {
    const html = document.documentElement
    if (themeAnimRef.current) {
      themeAnimRef.current = false
      html.setAttribute('data-theme-transitioning', '')
      clearTimeout(themeTransTimer.current)
      themeTransTimer.current = setTimeout(() => {
        html.removeAttribute('data-theme-transitioning')
      }, 350)
    }
    if (prefs.theme === 'system') html.removeAttribute('data-theme')
    else html.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  useEffect(() => () => clearTimeout(themeTransTimer.current), [])

  // User-initiated theme change — arms the transition, then updates prefs. The
  // arm is consumed by the data-theme effect above on the resulting re-render.
  function changeTheme(theme: SipPrefs['theme']) {
    themeAnimRef.current = true
    update({ theme })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Restore the clock caret after a masked edit re-renders the controlled input
  // (React otherwise parks it at the end). Layout effect = synchronous, so it
  // lands before the next keystroke is processed.
  useLayoutEffect(() => {
    if (clockCaretRef.current !== null && clockRef.current) {
      const p = clockCaretRef.current
      clockRef.current.setSelectionRange(p, p)
      clockCaretRef.current = null
    }
  }, [clockInput])

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

  // The clock is a fixed 5-char "HH:MM" mask: the colon lives permanently at
  // index 2 and can never be deleted, and every digit slot always holds a
  // character. Because the length never changes, the field can't reflow (no
  // horizontal/vertical shift), and the caret hops over the colon on edit.
  function commitClock(next: string, caret: number) {
    if (next === clockInput) {
      // No value change → no re-render (and no layout effect); the field still
      // holds `next`, so move the caret now.
      clockRef.current?.setSelectionRange(caret, caret)
    } else {
      // Stash the caret; the layout effect restores it synchronously right after
      // React commits the new value, before the next key event is dispatched.
      clockCaretRef.current = caret
      setClockInput(next)
    }

    clearTimeout(clockTimerRef.current)
    clockTimerRef.current = setTimeout(() => {
      const mins = parseClockInput(next)
      if (mins !== null) update({ intervalMinutes: mins })
    }, 500)
  }

  // Fallback for non-keyboard input (autofill / IME). Keyboard edits are
  // handled in handleClockKeyDown, which preventDefaults and never fires this.
  function handleClockChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4).padEnd(4, '0')
    commitClock(`${digits.slice(0, 2)}:${digits.slice(2)}`, 5)
  }

  function handleClockPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!digits) return
    const chars = clockInput.split('')
    let pos = (e.currentTarget.selectionStart ?? 0) === 2 ? 3 : (e.currentTarget.selectionStart ?? 0)
    for (const d of digits) {
      if (pos === 2) pos = 3       // never write onto the colon
      if (pos > 4) break
      chars[pos] = d
      pos += 1
    }
    commitClock(chars.join(''), pos === 2 ? 3 : pos)
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
    if (e.key === 'Enter') { e.currentTarget.blur(); return }
    // Let shortcuts and navigation (⌘A, ⌘V, arrows, Tab…) through untouched.
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const el = e.currentTarget
    const value = clockInput               // always "HH:MM"
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? start
    const chars = value.split('')

    // Typing over a selection clears the selected digit slots first.
    const clearSelection = () => {
      for (let i = start; i < end; i++) if (i !== 2) chars[i] = '0'
    }

    // Digit entry — overwrite semantics; the caret hops over the fixed colon.
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      if (start !== end) clearSelection()
      const pos = start === 2 ? 3 : start  // never land on the colon
      if (pos > 4) return                  // field is full
      chars[pos] = e.key
      let caret = pos + 1
      if (caret === 2) caret = 3           // skip the colon after the 2nd digit
      commitClock(chars.join(''), caret)
      return
    }

    // Backspace — clear the digit to the LEFT, skipping over the colon.
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (start !== end) { clearSelection(); commitClock(chars.join(''), start); return }
      let target = start - 1
      if (target === 2) target = 1         // colon sits to the left → skip it
      if (target < 0) return
      chars[target] = '0'
      commitClock(chars.join(''), target)
      return
    }

    // Delete — clear the digit to the RIGHT, skipping over the colon.
    if (e.key === 'Delete') {
      e.preventDefault()
      if (start !== end) { clearSelection(); commitClock(chars.join(''), start === 2 ? 3 : start); return }
      const target = start === 2 ? 3 : start  // colon to the right → skip it
      if (target > 4) return
      chars[target] = '0'
      commitClock(chars.join(''), target)     // Delete leaves the caret in place
      return
    }
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

  return (
    <>
    {/* Test fires a REAL toast here, top-right, through the same Sonner
        pipeline the extension uses. The preview in the pane below is
        decoration — it never animates and never moves. */}
    {/* --width is Sonner's own toast width and defaults to 356px, which would
        have squeezed the 450px toast and made Test disagree with the real
        thing at every viewport. Setting it to the same min() the scope uses
        makes the two identical. Below 600px Sonner switches to its own
        full-bleed rule using mobileOffset, so that has to match the 16px
        gutter the content script applies. */}
    <Toaster
      position={stacked ? 'top-center' : 'top-right'}
      offset="16px"
      mobileOffset="16px"
      visibleToasts={3}
      toastOptions={{ unstyled: true }}
      style={{ '--width': 'min(450px, calc(100vw - 32px))' } as CSSProperties}
    />

    {/* Fixed-height flex tree, not a flowing page. That is what pins the
        preview: the only element that scrolls is the control column, so the
        toast can never be scrolled off screen — the whole point of the
        editor layout. */}
    <div className="h-[100dvh] w-full flex flex-col font-sans antialiased bg-surface-base text-text-primary">

      {/* ── nav ── */}
      <div className="flex-none flex items-center justify-between gap-3 py-4 px-8 narrow:py-3 narrow:px-4">
        <div className="flex items-center gap-2">
          <SipMark />
          {/* Icon-only once the nav is competing with the links for a 320px
              line — the mark carries the brand on its own. */}
          <span
            className="narrow:hidden font-semibold text-transparent bg-clip-text text-[16px] narrow:text-[14px] leading-[1.25] tracking-normal"
            style={{
              backgroundImage: 'linear-gradient(in oklab 180deg, oklab(75% -0.113 -0.049) 0%, oklab(53.6% -0.009 -0.212) 100%)',
            }}
          >
            Sip Hydra
          </span>
        </div>

        {headerRight ?? (
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-text-muted hover:text-text-secondary transition-colors bg-transparent border-0 p-0 outline-none leading-none appearance-none"
          >
            <XIcon size={12} />
          </button>
        )}
      </div>

      {/* ── body ──
          DOM order is [preview, controls] and the row is REVERSED, so the
          preview lands on the right on desktop and on top when stacked. One
          property flips (row-reverse → column); nothing is duplicated.

          Controls-on-the-left is deliberate: the toast only ever arrives
          centre or right of a real screen, so the preview sits on the side the
          real thing does — and a Test toast animates in over the empty pane
          rather than over a dense column of controls. */}
      <div className="flex-1 min-h-0 flex flex-row-reverse gap-2 px-4 pb-4 narrow:flex-col">

        {/* preview — the elastic half. The control column is rigid, so ALL of
            the horizontal give lives here; that is what lets the panel hold
            its size down to an iPhone SE instead of squeezing with the
            viewport. overflow-clip-margin keeps the resting toast's shadow
            from being sheared at the pane edge. */}
        <section className="flex-1 min-w-0 min-h-0 narrow:flex-none flex items-center justify-center p-4 narrow:p-3 rounded-xl bg-surface-card overflow-clip [overflow-clip-margin:12px]">
          <div className="w-full flex flex-col items-center justify-center gap-4 narrow:gap-2.5">

            {/* Decorative reference, not a live toast: same component as the
                real thing (so the two can never drift), but inert and
                unanimated. aria-hidden because Test provides the real one. */}
            <div className="w-full max-w-[450px] pointer-events-none select-none" aria-hidden>
              <SipToast platform={platform} prefs={prefs} onDismiss={() => {}} mode="preview" />
            </div>

            <button
              onClick={testToast}
              /* sip-hover-tint, not a background-image swap: a gradient has no
                 interpolable "from" state against `none`, so the previous hover
                 snapped on instead of fading. The utility fades a --state-hover
                 pseudo-element's opacity, which keeps the alpha token and gets
                 a real transition. */
              className="btn-press sip-hover-tint cursor-pointer w-full max-w-[450px] p-3 rounded-3xl border-0 appearance-none outline-none bg-surface-action text-text-action text-center text-[20px] leading-[1.2] font-semibold tracking-normal"
            >
              Test
            </button>
          </div>
        </section>

        {/* controls — rigid 290px; the one place scrolling is permitted */}
        <section className="flex-none basis-[290px] min-h-0 flex flex-col narrow:basis-auto narrow:flex-1 narrow:w-full">
          {/* The radius is on the SCROLLER, not just the cards: overflow-y clips
              to the padding box, so without it a card sliding past the top or
              bottom edge gets squared off mid-scroll. Matching the cards' 16px
              means the clip follows their own corner. */}
          <div className="sip-no-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 rounded-xl">

            {/* ── message ── */}
            <Card title="Text">
              <div className="flex flex-col gap-gap-md">
                <Field label="Title" counter={`${prefs.titleText.length}/40 Chars`} over={prefs.titleText.length >= 35}>
                  <input
                    type="text"
                    value={prefs.titleText}
                    maxLength={40}
                    onChange={e => update({ titleText: e.target.value })}
                    className={`${FIELD_CLS} font-semibold`}
                  />
                </Field>
                <Field label="Message" counter={`${prefs.messageText.length}/60 Chars`} over={prefs.messageText.length >= 55}>
                  <textarea
                    value={prefs.messageText}
                    maxLength={60}
                    onChange={e => update({ messageText: e.target.value })}
                    className={`${FIELD_CLS} font-medium h-[72px] resize-none`}
                  />
                </Field>
              </div>
            </Card>

            {/* ── bottle ── */}
            <Card title="Bottle">
              <div className="flex flex-col gap-gap-md">
                <Field label="Type">
                  {/* aspect-square, not a fixed height: these are flex-1, so a
                      fixed height turns them into rectangles the moment the
                      column goes full-width on a stacked phone. */}
                  <div className="flex gap-1.5">
                    {TYPE_ORDER.map(type => (
                      <button
                        key={type}
                        onClick={() => update({ bottleType: type })}
                        aria-pressed={prefs.bottleType === type}
                        aria-label={type}
                        className={`btn-press cursor-pointer flex-1 min-w-0 aspect-square flex items-center justify-center rounded-xl overflow-clip appearance-none p-0 outline-none border ${
                          prefs.bottleType === type
                            ? 'bg-surface-selected border-border-selected'
                            : 'bg-surface-field border-border-field'
                        }`}
                      >
                        <img
                          src={platform.getBottleUrl(type, prefs.bottleColor)}
                          alt=""
                          className="h-[66%] w-auto object-contain block"
                        />
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Color">
                  <div className="flex gap-1.5">
                    {COLOR_ORDER.map(color => (
                      <button
                        key={color}
                        onClick={() => update({ bottleColor: color })}
                        aria-pressed={prefs.bottleColor === color}
                        aria-label={color}
                        /* rounded-full, not a px value: these are aspect-square
                           and flex-1, so their side length changes with the
                           column width. Any fixed radius would read as a
                           different shape at 38px than at 49px; 9999px always
                           resolves to a circle. */
                        className="btn-press cursor-pointer relative flex-1 min-w-0 aspect-square rounded-full overflow-clip shadow-subtle appearance-none p-0 outline-none border-0"
                        style={{ backgroundColor: BOTTLE_COLORS[color] }}
                      >
                        {/* The design ships no selected state for these. A ring
                            would collide with the 6px gaps, so selection lives
                            inside the swatch — white, with a soft shadow so it
                            survives on yellow as well as on purple. */}
                        {prefs.bottleColor === color && (
                          <span className="absolute inset-0 flex items-center justify-center text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.35))]">
                            <CheckIcon />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </Card>

            {/* ── timing ── */}
            <Card title="Timing">
              <div className="relative flex items-center justify-center py-pad-lg rounded-chip bg-surface-field border border-border-field transition-colors focus-within:border-brand-primary">
                <input
                  ref={clockRef}
                  type="text"
                  inputMode="numeric"
                  value={clockInput}
                  onChange={handleClockChange}
                  onBlur={handleClockBlur}
                  onKeyDown={handleClockKeyDown}
                  onPaste={handleClockPaste}
                  aria-label="Reminder interval"
                  maxLength={5}
                  className="absolute inset-0 w-full bg-transparent border-0 outline-none text-center font-sans text-[80px] leading-none font-semibold text-transparent caret-text-strong"
                />
                {/* Colored mirror: the native input owns the real value and
                    caret (its own text is transparent); this overlay repaints
                    the digits so the colon can be dimmed. */}
                <div aria-hidden className="pointer-events-none select-none flex items-center justify-center text-[80px] leading-none font-semibold text-text-strong">
                  {clockInput.slice(0, 2)}
                  {/* SF Pro Rounded centres the colon on the x-height band, so
                      it reads low between full-height numerals. -0.08em is the
                      design's -6.4px at 80px; a transform, so no reflow. */}
                  <span className="text-text-muted translate-y-[-0.08em]">{clockInput[2]}</span>
                  {clockInput.slice(3)}
                </div>
              </div>

              <div className="flex items-center gap-xs">
                <span className="shrink-0 text-[15px] leading-[1.2] font-semibold text-text-muted">Every:</span>
                {/* No tabular-nums. It forces every digit to the widest digit's
                    advance, which in SF Pro Rounded visibly pads the narrow "1"
                    — that is the odd gap in "15". Tabular figures earn their
                    keep in a column of numbers that must align, or a value that
                    ticks in place; this is a left-aligned phrase inside a flex
                    row, so it gains nothing and costs the spacing. */}
                <span className="text-[15px] leading-[1.2] font-semibold text-text-label">
                  {intervalWords(prefs.intervalMinutes)}
                </span>
              </div>
            </Card>

            {/* ── appearance ── */}
            <Card title="Appearance">
              {/* Radii translated from the Paper export by PIXEL, not by class
                  name — Paper writes against Tailwind's default scale where
                  rounded-xl is 12px, while this repo remaps rounded-xl to 16px.
                  Track: 12px (repo rounded-lg), 4px padding, selected segment
                  8px (repo rounded-sm). Those three are not independent: an
                  inset child's radius should be the parent's minus the padding
                  (12 − 4 = 8) or the two curves run non-concentric. */}
              <div className="flex p-1 rounded-lg bg-surface-field">
                {(['system', 'light', 'dark'] as const).map(theme => (
                  <button
                    key={theme}
                    onClick={() => changeTheme(theme)}
                    aria-pressed={prefs.theme === theme}
                    /* Semibold in BOTH states (the export has medium when
                       unselected). Weight no longer carries the selection, so
                       the row cannot re-flow as the selection moves — colour
                       and the filled track do the work instead. */
                    /* Same 8px radius in both states. The track is 12px with
                       4px of padding, so 8px is also the concentric value —
                       the pill's curve stays parallel to the track's whether
                       it is filled or not. */
                    /* Unselected is bg-surface-field — the TRACK's own colour —
                       not bg-transparent. Identical at rest, but it changes what
                       the theme fade animates: transparent makes the outgoing
                       pill fade its ALPHA out while the incoming fades in, so
                       mid-fade both are translucent and a light ghost sits over
                       a darkening track. Two opaque colours cross-fade instead,
                       which is what every other surface in the app does. */
                    className={`btn-press cursor-pointer flex-1 min-w-0 flex items-center justify-center gap-1 py-2 rounded-sm border-0 appearance-none outline-none text-[15px] leading-[18px] font-semibold ${
                      prefs.theme === theme
                        ? 'bg-surface-selected text-text-primary'
                        : 'bg-surface-field text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    <ThemeIcon theme={theme} />
                    <span>{theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'}</span>
                  </button>
                ))}
              </div>
            </Card>

          </div>
        </section>
      </div>
    </div>
    </>
  )
}

// ─── control-panel primitives ─────────────────────────────────────────────────

// Every card is the same box: 16px padding, 16px internal gap, 24px radius,
// recessed surface, one uppercase heading. Inter-card gap is 8px, set by the
// scroller.
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex-none flex flex-col gap-gap-md p-pad-lg rounded-xl bg-surface-card">
      <span className="text-[13px] leading-[1.25] font-semibold uppercase tracking-[0.02em] text-text-muted">
        {title}
      </span>
      {children}
    </div>
  )
}

// Label row + control. `counter` is optional — Bottle's Type/Color rows use the
// same label treatment without one.
function Field({ label, counter, over, children }: {
  label: string; counter?: string; over?: boolean; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[16px] leading-[1.2] font-semibold text-text-label">{label}</span>
        {counter && (
          <span className={`text-[16px] leading-[1.2] font-medium ${over ? 'text-text-error' : 'text-text-muted'}`}>
            {counter}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// Focus is a brand-blue 1px stroke assembled from a 0.5px border plus a 0.5px
// outline, so gaining focus can never reflow the field.
const FIELD_CLS =
  'w-full box-border p-pad-md rounded-lg bg-surface-field border border-border-field ' +
  'text-text-strong font-sans text-[15px] leading-[1.25] appearance-none ' +
  'outline-none transition-colors focus:border-brand-primary focus:outline ' +
  'focus:outline-[0.5px] focus:outline-brand-primary focus:outline-offset-0'

// ─── brand mark ───────────────────────────────────────────────────────────────
// Inline rather than an <img>: it is a fixed two-stop gradient that does not
// change with theme, so there is nothing to swap and no request to make. The
// gradient id is namespaced — a bare "paint0_linear" collides with any other
// inlined SVG on the page and silently repaints one of them.

export function SipMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" fill="none" className="block shrink-0" aria-label="Sip Hydra">
      <path d="M0 512C0 229.23 229.23 0 512 0V0C794.77 0 1024 229.23 1024 512V512C1024 794.77 794.77 1024 512 1024V1024C229.23 1024 0 794.77 0 512V512Z" fill="url(#sipMark0)"/>
      <path d="M758.006 535.607C740.026 543.125 720.357 545.207 701.11 543.373C688.397 542.158 676.853 538.622 665.316 533.806C658.989 531.162 653.713 527.511 648.222 523.545C632.876 512.458 618.64 496.117 610.863 478.924C605.819 467.788 602.109 456.808 600.444 444.656C596.08 412.799 602.018 378.034 612.726 347.706C615.352 338.305 619.559 330.109 623.418 321.236L629.994 306.142L654.583 256.548L660.14 245.453L676.124 213.431L693.756 178.221C696.654 172.421 699.71 166.894 704.845 162.805C709.938 158.748 717.682 159.103 722.378 163.796C726.361 167.778 729.823 172.553 732.448 177.642L745.699 203.245L756.433 224.758L765.617 242.983L799.564 310.496L803.415 319.088L810.024 334.05C817.685 351.391 822.828 369.608 825.81 388.378C826.977 395.747 828.418 402.67 828.907 409.957C830.199 429.256 829.114 443.838 823.706 462.286C819.341 477.157 812.525 490.449 802.289 502.098L786.628 517.779C778.404 526.007 768.698 531.146 758.031 535.607H758.006Z" fill="url(#sipMark1)"/>
      <path d="M435.127 850.012C405.26 862.542 372.587 866.012 340.616 862.955C319.499 860.931 300.322 855.037 281.158 847.01C270.648 842.604 261.885 836.518 252.764 829.909C227.272 811.43 203.623 784.195 190.706 755.541C182.328 736.98 176.164 718.681 173.399 698.426C166.149 645.332 176.013 587.391 193.801 536.844C198.162 521.174 205.151 507.515 211.561 492.727L222.484 467.571L263.329 384.914L272.56 366.422L299.111 313.052L328.4 254.368C333.215 244.702 338.291 235.49 346.821 228.674C355.281 221.914 368.144 222.506 375.944 230.327C382.561 236.963 388.312 244.922 392.673 253.404L414.684 296.075L432.513 331.93L447.77 362.305L504.16 474.827L510.557 489.147L521.535 514.083C534.26 542.985 542.803 573.346 547.756 604.63C549.696 616.912 552.089 628.451 552.901 640.595C555.047 672.76 553.245 697.063 544.262 727.81C537.012 752.594 525.69 774.749 508.686 794.164L482.671 820.298C469.011 834.012 452.887 842.576 435.168 850.012H435.127Z" fill="url(#sipMark2)"/>
      <defs>
      <linearGradient id="sipMark0" x1="512" y1="0" x2="512" y2="1024" gradientUnits="userSpaceOnUse">
      <stop stopColor="#00D9E7"/>
      <stop offset="1" stopColor="#3D3BFF"/>
      </linearGradient>
      <linearGradient id="sipMark1" x1="714.2" y1="160" x2="714.2" y2="543.999" gradientUnits="userSpaceOnUse">
      <stop stopColor="#D8F8FB"/>
      <stop offset="1" stopColor="#00D9E7"/>
      </linearGradient>
      <linearGradient id="sipMark2" x1="362.36" y1="224" x2="362.36" y2="863.998" gradientUnits="userSpaceOnUse">
      <stop stopColor="#AFF0F5"/>
      <stop offset="1" stopColor="#00D9E7"/>
      </linearGradient>
      </defs>
    </svg>
  )
}

// ─── themed logo (light/dark crossfade) ───────────────────────────────────────
// The SIP logo is a raster asset that swaps per theme (getIconUrl(_, dark)), so a
// color transition can't interpolate it — it would hard-pop mid-animation. Instead
// we stack both variants and crossfade opacity. Both stay mounted (no load flash);
// the opacity change only animates while [data-theme-transitioning] is armed
// (tokens.css), so outside a theme switch it swaps instantly.
export function ThemedLogo({
  platform, size, dark, assetSize, radius,
}: {
  platform: SipPlatform; size: number; dark: boolean; assetSize: 16 | 32 | 64 | 128; radius?: number
}) {
  const layer: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'contain', display: 'block', borderRadius: radius,
  }
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <img src={platform.getIconUrl(assetSize, false)} alt="SIP" style={{ ...layer, opacity: dark ? 0 : 1 }} />
      <img src={platform.getIconUrl(assetSize, true)} alt="" aria-hidden style={{ ...layer, opacity: dark ? 1 : 0 }} />
    </span>
  )
}

// ─── icons ────────────────────────────────────────────────────────────────────

export function XIcon({ size = 10 }: { size?: number }) {
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
  // 18px, and stroke weights straight from the export — deliberately NOT
  // uniform: the frames are 2.5 and the small interior marks are 2, so the
  // detail does not read heavier than the shape containing it. Scaling these
  // to a single weight is what makes icon sets look muddy at small sizes.
  //
  // stroke=currentColor throughout (the export hard-codes #8D8F98 / #323338),
  // so the parent button's text colour drives the icon and selected / hover /
  // idle are all controlled in one place.
  if (theme === 'system') {
    return (
      <svg width="18" height="18" viewBox="0 0 28.8 28.8" fill="none" className="shrink-0" aria-hidden>
        <path d="M25.2 8.402v12c0 3.6-1.8 6-6 6H9.6c-4.2 0-6-2.4-6-6V8.402c0-3.6 1.8-6 6-6h9.6c4.2 0 6 2.4 6 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="7.2" y="6.002" width="14.4" height="7.2" rx="1.75" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.36 18.362l-2.76 2.76m0-2.76l2.76 2.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (theme === 'light') {
    // icon:sun.svg, inlined with currentColor swapped in for its #323338.
    return (
      <svg width="18" height="18" viewBox="0 6.383 18 18" fill="none" className="shrink-0" aria-hidden>
        <circle cx="9" cy="15" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 7.5v1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 21v1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.697 9.697l1.058 1.058" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.245 19.245l1.058 1.057" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.5 15h1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 15h1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.755 19.245l-1.057 1.057" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.303 9.697l-1.058 1.058" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="-1.5 -1.3 28.8 28.8" fill="none" className="shrink-0" aria-hidden>
      <path d="M1.694 14.063c0.416 5.767 5.47 10.459 11.519 10.716 4.267 0.179 8.084-1.747 10.373-4.781 0.948-1.243 0.439-2.072-1.145-1.791-0.775 0.134-1.573 0.19-2.405 0.156-5.655-0.224-10.281-4.804-10.304-10.212-0.012-1.456 0.301-2.833 0.867-4.087 0.624-1.389-0.127-2.049-1.573-1.456C4.447 4.478 1.313 8.946 1.694 14.063Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
