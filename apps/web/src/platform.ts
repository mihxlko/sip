import {
  BottleColor, BottleType, DEFAULT_PREFS, sanitizePrefs,
  type SipPlatform, type SipPrefs,
} from '@sip/types'

const STORAGE_KEY = 'sipPrefs'

const BOTTLE_FILES: Record<BottleType, Record<BottleColor, string>> = {
  [BottleType.Classic]: {
    [BottleColor.Red]:    '1.1-yeti-red.png',
    [BottleColor.Orange]: '1.2-yeti-orange.png',
    [BottleColor.Yellow]: '1.3-yeti-yellow.png',
    [BottleColor.Green]:  '1.4-yeti-green.png',
    [BottleColor.Blue]:   '1.5-yeti-blue.png',
    [BottleColor.Purple]: '1.6-yeti-purple.png',
  },
  [BottleType.Sport]: {
    [BottleColor.Red]:    '2.1-camelbak-red.png',
    [BottleColor.Orange]: '2.2-camelbak-orange.png',
    [BottleColor.Yellow]: '2.3-camelbak-yellow.png',
    [BottleColor.Green]:  '2.4-camelbak-green.png',
    [BottleColor.Blue]:   '2.5-camelbak-blue.png',
    [BottleColor.Purple]: '2.6-camelbak-purple.png',
  },
  [BottleType.Wide]: {
    [BottleColor.Red]:    '3.1-bibs-red.png',
    [BottleColor.Orange]: '3.2-bibs-orange.png',
    [BottleColor.Yellow]: '3.3-bibs-yellow.png',
    [BottleColor.Green]:  '3.4-bibs-green.png',
    [BottleColor.Blue]:   '3.5-bibs-blue.png',
    [BottleColor.Purple]: '3.6-bibs-purple.png',
  },
}

async function getPrefs(): Promise<SipPrefs> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULT_PREFS }
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

async function setPrefs(updates: Partial<SipPrefs>): Promise<void> {
  const current = await getPrefs()
  const next: SipPrefs = { ...current, ...sanitizePrefs(updates) }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent<SipPrefs>('sip-prefs-changed', { detail: next }))
}

function onPrefsChanged(callback: (prefs: SipPrefs) => void): () => void {
  const listener = (e: Event) => callback((e as CustomEvent<SipPrefs>).detail)
  window.addEventListener('sip-prefs-changed', listener)
  return () => window.removeEventListener('sip-prefs-changed', listener)
}

function getBottleUrl(type: BottleType, color: BottleColor): string {
  return `/bottles/${BOTTLE_FILES[type][color]}`
}

// No-op: the web app's only page is the settings page itself.
function openSettings(): void {}

export const webPlatform: SipPlatform = {
  getPrefs,
  setPrefs,
  onPrefsChanged,
  getBottleUrl,
  openSettings,
}
