import type { BottleColor, BottleType, SipPrefs } from './prefs'

// Abstraction over the host environment (Chrome extension vs. web app) so
// shared UI components never call chrome.* or browser storage APIs directly.
export interface SipPlatform {
  getPrefs(): Promise<SipPrefs>
  setPrefs(updates: Partial<SipPrefs>): Promise<void>
  onPrefsChanged(callback: (prefs: SipPrefs) => void): () => void
  getBottleUrl(type: BottleType, color: BottleColor): string
  getIconUrl(size: 16 | 32 | 64 | 128, dark?: boolean): string
  openSettings(): void
}
