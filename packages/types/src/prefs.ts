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

export interface SipPrefs {
  bottleType:      BottleType
  bottleColor:     BottleColor
  titleText:       string       // max 100 chars
  messageText:     string       // max 120 chars
  intervalMinutes: number
  customIcon:      string | null // base64 data-URL, or null to use the default SIP logo
  showLogo:        boolean
  theme:           Theme
}

export const DEFAULT_PREFS: Readonly<SipPrefs> = {
  bottleType:      BottleType.Classic,
  bottleColor:     BottleColor.Blue,
  titleText:       'Drink Up!',
  messageText:     'Sending you a friendly reminder to drink some water.',
  intervalMinutes: 15,
  customIcon:      null,
  showLogo:        true,
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
