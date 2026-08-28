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
  // 85, not an arbitrary round number: at the 360px floor the mobile variant
  // gives the message a 250px column, and 85 characters of realistic text is
  // what fits two lines there (measured, not estimated). Past that the
  // line-clamp truncates rather than growing the toast, so this is the point
  // where text starts disappearing silently.
  //
  // Re-measure this if the right rail or the 360px floor moves — it tracks
  // the column, and the column is what those two decide.
  //
  // The Settings form caps its own input at 60, which is a product choice and
  // already well inside this. This limit is what guards prefs written by
  // anything other than that form.
  messageText:     string       // max 85 chars
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
    out.messageText = out.messageText.slice(0, 85)
  }

  if (out.intervalMinutes !== undefined) {
    out.intervalMinutes = Math.max(1, Math.floor(out.intervalMinutes))
  }

  return out
}
