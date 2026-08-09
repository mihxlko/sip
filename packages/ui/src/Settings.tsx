import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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

function resolveIsDark(theme: SipPrefs['theme']): boolean {
  if (theme === 'dark')  return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
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
    {/* content root */}
    {/* dock:pt-[68px] clears the docked bar. The bar is 64 tall (20 top pad +
        24 items + 20 bottom pad) and the cards should sit a gap-lg below it, so
        content starts at 88 — minus the 20 the shells contribute above this
        element = 68. Floating, the cards stay flush at 44 as before. */}
    <div
      className="relative w-full font-sans antialiased flex flex-col gap-gap-lg bg-surface-base p-gap-lg dock:pt-[68px]"
    >

        {/* ── header ── */}
        {/* Viewport-fixed nav: the brand and right-side actions stay put while
            the page scrolls beneath them. No background band — cards must reach
            the viewport top edge uncovered (no-horizontal-scroll / no-band rule,
            see design-docs.md). pointer-events-none lets clicks and scrolls pass
            through everywhere except the interactive right cluster. The inner
            container mirrors both app shells (max-w 2240, centered) and stretches
            edge to edge, so the brand and the actions sit on the same 24px gutter
            as the cards below at every width — including the stacked breakpoint,
            where nav and card share one left/right edge. */}
        {/* The nav stays `fixed` in BOTH states — "docked" is a fill plus a
            content offset, not a change of positioning. Going in-flow would make
            the bar reserve its own space, so the shells' compensating padding
            would have to be unwound in exactly the `dock` ranges and the content
            would jump at every boundary. Same look, far less to get wrong.
            The scrim is 80% --surface-base + blur, so at scroll-0 it sits on the
            page background and is invisible: the bar only materialises once a
            card scrolls under it, which is the only moment it's needed.
            pointer-events-auto comes back with the fill — a visible bar that
            passes clicks through to the cards beneath reads as broken. */}
        <div className="fixed top-0 left-0 right-0 z-10 pointer-events-none dock:pointer-events-auto dock:bg-[var(--surface-nav-scrim)] dock:backdrop-blur-md">
          <div className="w-full max-w-[2240px] mx-auto box-border px-gap-lg pt-pad-xl dock:pb-pad-xl flex items-center justify-between">
          {/* brand — identical on web and extension */}
          <div className="flex items-center gap-2">
            <ThemedLogo platform={platform} size={24} assetSize={64} dark={dark} />
            {/* 14px/18px — between text-sm (13) and text-md (15), no token.
                Wordmark gradient colors exist only in the design, not tokens.css. */}
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
          <div className="pointer-events-auto">
            {headerRight ?? (
              <button
                onClick={onClose}
                aria-label="Close"
                className="cursor-pointer text-text-muted hover:text-text-secondary transition-colors bg-transparent border-0 p-0 outline-none leading-none appearance-none"
              >
                {/* 11 ≈ 15 scaled by the logo's 32→24 reduction */}
                <XIcon size={11} />
              </button>
            )}
          </div>
          </div>
        </div>

        {/* ── settings-controls: preview + bottom-controls ── */}
        {/* Two caps, one per layout. 872 is the two-column width. 450 is the
            stacked one, and it's the toast's existing max-width — reused rather
            than invented, so the preview card, the toast inside it and every
            stacked card below share one left/right edge.
            Without the 450 cap the column would run to 872 just under the
            breakpoint, and the cards' justify-between rows (3 type thumbs, 6
            swatches) would fling their items to opposite ends of an 850px card.
            Below 450 the cap is inert and the cards simply fill the gutter. */}
        <div className="w-full max-w-[450px] wide:max-w-[872px] mx-auto flex flex-col gap-gap-lg">

        {/* ── preview panel ── */}
        {/* px-gap-lg below `wide`: the panel exists to frame the toast, and once
            the column is capped at 450 the toast's own max-w-[450px] would fill it
            edge to edge and the frame would read as an accident. 24px matches the
            panel's own pb-gap-lg. At `wide` the 872px panel already has room. */}
        <div className="bg-surface-primary rounded-xxl shadow border-0.5 border-border-default flex flex-col items-center gap-gap-xl overflow-clip pt-gap-xxl pb-gap-lg px-gap-lg wide:px-0">
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
        {/* Below `wide` this is the single stacking column for ALL five cards.
            The two grouping wrappers below (bottom-right-controls, bottom-right-row)
            go `display: contents`, which drops them out of the box tree and promotes
            their cards to direct flex children here. That's what makes the stack
            order fall out of the existing DOM order for free — Bottle, Text, Time,
            Icon, Appearance — with no duplicated markup, no JSX reordering and one
            `gap-gap-lg` governing all five. At `wide` the wrappers become boxes
            again and the original two-column layout is restored untouched. */}
        <div className="flex flex-col gap-gap-lg wide:flex-row wide:items-stretch">

          {/* bottle card — wide:flex-1: takes leftover space after the content-sized
              right column. Only at `wide`: in the stacked column `flex-1` would
              resolve against the main axis and stretch the card vertically. */}
          <div className="wide:flex-1 bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-md">
            <span className="text-text-secondary text-md font-medium px-[8px]">Bottle</span>

            {/* large preview — 250×250 with 50px inner padding.
                250 is a hard width only inside the two-column row (where the card's
                content box is 251 — i.e. it already fills it). Stacked, the card is
                as wide as the viewport, so the preview fills it too: w-full keeps it
                flush with the Type/Color rows below instead of stranding ~45px of
                dead space, and it's what stops the widest box in the app from
                dictating a 282px floor on a 320px screen. Height is unchanged. */}
            <div
              className="w-full wide:w-[250px] bg-surface-base border-0.5 border-border-default rounded-xl shadow-subtle flex items-center justify-center overflow-clip p-space-padding-xl"
              style={{ height: 230 }}
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
                    className={`btn-press cursor-pointer relative overflow-clip rounded-md border-0.5 shadow-subtle flex items-center justify-center appearance-none p-0 outline-none ${
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
                    className="btn-press cursor-pointer overflow-clip shadow-subtle appearance-none p-0 outline-none"
                    style={{
                      width: 34, height: 34,
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: BOTTLE_COLORS[color],
                      outline: prefs.bottleColor === color ? `2px solid ${BOTTLE_COLORS[color]}` : undefined,
                      outlineOffset: prefs.bottleColor === color ? 1 : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* bottom-right-controls: text-card on top, bottom-right-row below.
              Content-sized width (no flex-1) so bottle takes the leftover.
              justify-between distributes any extra height (from items-stretch on
              the outer row) between the two children.
              Below `wide` this grouping has no meaning, so `contents` erases the
              box and hands its children up to the stacking column. */}
          <div className="contents wide:flex wide:flex-col wide:gap-gap-lg wide:justify-between">

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
                className="bg-surface-raised border-0.5 border-border-emphasis hover:border-border-focus focus:border-border-focus rounded-lg shadow-subtle px-pad-md py-pad-md text-lg font-semibold text-text-primary outline-none focus:outline focus:outline-[0.5px] focus:outline-border-focus focus:outline-offset-0 w-full box-border font-sans appearance-none"
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
                className="bg-surface-raised border-0.5 border-border-emphasis hover:border-border-focus focus:border-border-focus rounded-lg shadow-subtle px-pad-md py-pad-md text-lg font-medium text-text-primary outline-none focus:outline focus:outline-[0.5px] focus:outline-border-focus focus:outline-offset-0 w-full box-border font-sans resize-none"
                style={{ height: 72 }}
              />
            </div>
          </div>

          {/* ── bottom-right-row: time | icon | appearance ── */}
          {/* `contents` below `wide` — same reason as the wrapper above: the row
              dissolves and Time / Icon / Appearance become stacked column items. */}
          <div className="contents wide:flex wide:flex-row wide:gap-gap-lg wide:items-start">

          {/* time card — wide:flex-1 only; see the bottle card note on why */}
          <div className="wide:flex-1 bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-xl">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Time</span>

            <div className="relative">
              <input
                ref={clockRef}
                type="text"
                inputMode="numeric"
                value={clockInput}
                onChange={handleClockChange}
                onBlur={handleClockBlur}
                onKeyDown={handleClockKeyDown}
                onPaste={handleClockPaste}
                placeholder="HH:MM"
                maxLength={5}
                className="border-0.5 border-border-emphasis hover:border-border-focus focus:border-border-focus rounded-xl px-pad-md py-pad-md text-xl font-semibold text-transparent caret-text-primary leading-tight text-center w-full outline-none focus:outline focus:outline-[0.5px] focus:outline-border-focus focus:outline-offset-0 bg-surface-raised font-sans appearance-none"
              />
              {/* Colored mirror: the native input owns the real value + caret (its
                  own text is transparent); this overlay repaints the digits so the
                  colon can be dimmed to text-tertiary. */}
              <div
                aria-hidden
                className="pointer-events-none select-none absolute inset-0 flex items-center justify-center text-xl font-semibold leading-tight text-text-primary font-sans"
              >
                {clockInput.slice(0, 2)}
                {/* SF Pro Rounded centers the colon on the x-height band, so it reads
                    low between full-height numerals. Nudge it up onto the numeral
                    optical center. em-based → scales with --text-xl; transform → no reflow. */}
                <span className="text-text-tertiary translate-y-[-0.08em]">{clockInput[2]}</span>
                {clockInput.slice(3)}
              </div>
            </div>

            <div className="flex items-center justify-start gap-xs p-pad-md">
              <span className="text-text-muted text-lg font-medium shrink-0">Every:</span>
              <div className="flex-1 self-stretch rounded-xs shadow-subtle grid" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {/* Ghost sizer — an invisible copy of the widest possible interval
                    ("23 Hours 59 Minutes"). It shares this grid cell with the real
                    value, so the cell is always sized for the longest state and the
                    card never reflows as the value changes. Same classes = same
                    width, so it self-adjusts if the font or wording ever changes. */}
                <div aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-xs whitespace-nowrap">
                  <span className="text-lg font-medium inline-flex items-center"><span>23</span><span className="ml-1">Hours</span></span>
                  <span className="text-lg font-medium inline-flex items-center"><span>59</span><span className="ml-1">Minutes</span></span>
                </div>
                <div className="col-start-1 row-start-1 flex items-center gap-xs">
                  {Math.floor(prefs.intervalMinutes / 60) > 0 && (
                    <span className="text-lg font-medium text-text-primary inline-flex items-center">
                      <span>{Math.floor(prefs.intervalMinutes / 60)}</span>
                      <span className="ml-1">{Math.floor(prefs.intervalMinutes / 60) === 1 ? 'Hour' : 'Hours'}</span>
                    </span>
                  )}
                  {prefs.intervalMinutes % 60 > 0 && (
                    <span className="text-lg font-medium text-text-primary inline-flex items-center">
                      <span>{prefs.intervalMinutes % 60}</span>
                      <span className="ml-1">{prefs.intervalMinutes % 60 === 1 ? 'Minute' : 'Minutes'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* icon card — w-[130px]: fixed width, natural content height.
              Full-width once stacked; the 130px slot only exists in the row. */}
          <div className="w-full wide:w-[130px] wide:shrink-0 bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-sm">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Icon</span>

            {/* 100×100 preview — no token.
                Centering is right in the 130px column, but in a stacked full-width
                card it strands the icon mid-card away from the "Icon" label and the
                "Show Logo" row; left-align it there so the card reads as one edge. */}
            <div className="flex flex-col items-start wide:items-center gap-xs">
              <div
                className="border-0.5 border-border-default rounded-xl shadow-subtle flex items-center justify-center bg-surface-base"
                style={{ width: 100, height: 100 }}
              >
                {prefs.customIcon
                  ? <img src={prefs.customIcon} alt="custom" style={{ maxWidth: 63, maxHeight: 63, objectFit: 'contain', display: 'block' }} />
                  : <ThemedLogo platform={platform} size={63} assetSize={64} dark={dark} />
                }
              </div>
              <button
                onClick={pickIcon}
                className="cursor-pointer bg-transparent border-0 outline-none appearance-none p-0 text-sm font-medium text-text-tertiary hover:text-text-primary transition-colors"
              >
                Upload Custom
              </button>
            </div>

            {/* show logo — checkbox 18×18: no token */}
            <div
              className="btn-press-group flex items-center gap-pad-md cursor-pointer select-none"
              role="checkbox"
              aria-checked={prefs.showLogo}
              tabIndex={0}
              onClick={() => update({ showLogo: !prefs.showLogo })}
              onKeyDown={e => e.key === ' ' && update({ showLogo: !prefs.showLogo })}
            >
              <div
                className="btn-press-scale border-0.5 border-border-emphasis rounded-xs shadow-subtle flex items-center justify-center shrink-0 overflow-clip bg-surface-elevated"
                style={{ width: 18, height: 18 }}
              >
                {prefs.showLogo && (
                  <span className="text-text-primary">
                    <CheckIcon />
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">Show Logo</span>
            </div>
          </div>

          {/* appearance card — w-[130px]: no token, matches popup.
              Full-width once stacked; the 130px slot only exists in the row. */}
          <div className="w-full wide:w-[130px] wide:shrink-0 bg-surface-primary rounded-xxl shadow border-0.5 border-border-default overflow-clip p-pad-lg flex flex-col gap-gap-sm">
            <span className="text-text-secondary text-md font-medium pl-[4px]">Appearance</span>

            {/* button group — no chrome; container is just the buttons */}
            <div className="flex flex-col gap-0.5">
              {(['system', 'light', 'dark'] as const).map(theme => (
                <button
                  key={theme}
                  onClick={() => changeTheme(theme)}
                  /* Unselected = bg-transparent (not bg-surface-primary): visually identical
                     over the surface-primary card at rest, but it keeps the alpha profile
                     aligned with the selected state (state-selected ~0.08). Otherwise the
                     just-picked button gets its bg animated from opaque surface-primary →
                     transparent state-selected on a theme switch, so its opaque color "holds"
                     and lags the crossfade instead of fading in with it. */
                  className={`cursor-pointer flex items-center gap-1 rounded-md px-0.5 py-1 border-0 outline-none appearance-none w-full ${
                    prefs.theme === theme
                      ? 'bg-state-selected text-text-secondary'
                      : 'bg-transparent text-text-tertiary hover:bg-state-hover hover:text-text-secondary'
                  }`}
                >
                  <div
                    className="rounded-sm shadow-subtle flex items-center justify-center shrink-0"
                    style={{ width: 24, height: 24 }}
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

// ─── toast preview (visual-only, no dismiss logic) ────────────────────────────

function ToastPreview({ platform, prefs, dark }: { platform: SipPlatform; prefs: SipPrefs; dark: boolean }) {
  const src = platform.getBottleUrl(prefs.bottleType, prefs.bottleColor)

  return (
    <div className="w-full max-w-[450px] bg-surface-elevated border-0.5 border-border-emphasis rounded-xl shadow p-pad-xl flex flex-col overflow-clip">

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
                  /* flex (not block): a block wrapper gets a 24px text line box
                     (base line-height strut) around the 16px logo, inflating the
                     title row and shifting the whole toast when toggled. flex
                     shrink-wraps to the logo so items-center can truly center it. */
                  <div className="shrink-0 flex">
                    {prefs.customIcon
                      ? <img src={prefs.customIcon} width={28} height={18} className="block rounded-md object-cover" />
                      : <ThemedLogo platform={platform} size={16} assetSize={32} dark={dark} radius={4} />
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
    <svg width="15" height="15" viewBox="-1.5 -1.3 24 24" fill="none">
      <path d="M0.777 11.175C1.137 16.325 5.507 20.515 10.737 20.745C14.427 20.905 17.727 19.185 19.707 16.475C20.527 15.365 20.087 14.625 18.717 14.875C18.047 14.995 17.357 15.045 16.637 15.015C11.747 14.815 7.747 10.725 7.727 5.895C7.717 4.595 7.987 3.365 8.477 2.245C9.017 1.005 8.367 0.415 7.117 0.945C3.157 2.615 0.447 6.605 0.777 11.175Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
