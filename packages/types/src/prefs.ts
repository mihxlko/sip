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
  messageText:     string       // max 120 chars
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
    out.messageText = out.messageText.slice(0, 120)
  }

  if (out.intervalMinutes !== undefined) {
    out.intervalMinutes = Math.max(1, Math.floor(out.intervalMinutes))
  }

  return out
}
