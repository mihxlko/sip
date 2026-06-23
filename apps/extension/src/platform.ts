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
  const next: SipPrefs = { ...current, ...sanitizePrefs(updates) }
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: next }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        chrome.runtime.sendMessage({ type: 'UPDATE_ALARM', payload: next }).catch(() => {})
        resolve()
      }
    })
  })
}

function onPrefsChanged(callback: (prefs: SipPrefs) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'sync') return
    const next = changes[STORAGE_KEY]?.newValue
    if (next) callback({ ...DEFAULT_PREFS, ...next })
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

function getBottleUrl(type: BottleType, color: BottleColor): string {
  return chrome.runtime.getURL(`bottles/${BOTTLE_FILES[type][color]}`)
}

// Routed through a message rather than chrome.tabs.create directly because
// content scripts can call chrome.runtime.sendMessage but not chrome.tabs.*.
function openSettings(): void {
  chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS_TAB' })
}

export const chromePlatform: SipPlatform = {
  getPrefs,
  setPrefs,
  onPrefsChanged,
  getBottleUrl,
  openSettings,
}
