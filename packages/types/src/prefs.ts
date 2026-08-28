export enum BottleType {
  Classic = 'classic',
  Wide    = 'wide',
  Sport   = 'sport',
}

export enum BottleColor {
  Red    = 'red',
  Orange = 'orange',
  Yellow = 'yellow',
  Green  = 'green',
  Blue   = 'blue',
  Purple = 'purple',
}

export type Theme = 'system' | 'light' | 'dark'

// v2 removed `customIcon` and `showLogo` along with the Settings "Icon" card —
// the logo beside the toast title is gone from the design. Existing stored
// prefs may still carry those keys; they spread through getPrefs() harmlessly
// and are simply never read, so no migration is required.
export interface SipPrefs {
  bottleType:      BottleType
  bottleColor:     BottleColor
  titleText:       string       // max 100 chars
  // 80, and it is the FALLBACK font that sets it, not the real one. At the
  // 360px floor the message column is 250px, and the two-line capacity there
  // depends on what is actually rendering:
  //
  //   SF Pro Rounded loaded   85
  //   ui-rounded / system-ui  80   <- binding
  //   Segoe UI / Roboto       82
  //   sans-serif              82
  //
  // Sizing to 85 would have been correct only while the webfont is in hand.
  // registerToastFonts() in the content script notes that a host page's CSP
  // can block chrome-extension:// font URLs outright, in which case the toast
  // renders in the fallback for its whole lifetime — and font-display:swap
  // means even a successful load paints the fallback first. On those pages an
  // 85-character message wraps to three lines and the line-clamp eats the
  // third, silently.
  //
  // 80 is the narrowest fallback's capacity, so the message fits whichever
  // face wins. Re-measure if the rail, the 360px floor, or the fallback stack
  // moves — all three feed the column, and the column is the whole input.
  //
  // The Settings form caps its own input at 60, which is a product choice and
  // already well inside this. This limit is what guards prefs written by
  // anything other than that form.
  messageText:     string       // max 80 chars
  intervalMinutes: number
  theme:           Theme
}

export const DEFAULT_PREFS: Readonly<SipPrefs> = {
  bottleType:      BottleType.Classic,
  bottleColor:     BottleColor.Blue,
  titleText:       'Drink Up!',
  messageText:     'Sending you a friendly reminder to drink some water.',
  intervalMinutes: 15,
  theme:           'system',
}

export function sanitizePrefs(updates: Partial<SipPrefs>): Partial<SipPrefs> {
  const out = { ...updates }

  if (out.titleText !== undefined) {
    out.titleText = out.titleText.slice(0, 100)
  }

  if (out.messageText !== undefined) {
    out.messageText = out.messageText.slice(0, 80)
  }

  if (out.intervalMinutes !== undefined) {
    out.intervalMinutes = Math.max(1, Math.floor(out.intervalMinutes))
  }

  return out
}
