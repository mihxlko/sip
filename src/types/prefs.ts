export enum BottleType {
  Classic = 'classic',
  Wide    = 'wide',
  Sport   = 'sport',
}

export enum BottleColor {
  Pink   = 'pink',
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
  titleText:       'Time to SIP! 💧',
  messageText:     'Stay hydrated — drink a glass of water now.',
  intervalMinutes: 15,
  customIcon:      null,
  showLogo:        true,
  theme:           'system',
}

const STORAGE_KEY = 'sipPrefs'

export async function getPrefs(): Promise<SipPrefs> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY]
      resolve(stored ? { ...DEFAULT_PREFS, ...stored } : { ...DEFAULT_PREFS })
    })
  })
}

export async function setPrefs(updates: Partial<SipPrefs>): Promise<void> {
  const current = await getPrefs()
  const next: SipPrefs = { ...current, ...sanitize(updates) }
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: next }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve()
      }
    })
  })
}

function sanitize(updates: Partial<SipPrefs>): Partial<SipPrefs> {
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
