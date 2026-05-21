import { getPrefs } from '../types/prefs'

const ALARM_NAME = 'sip-reminder'

chrome.runtime.onInstalled.addListener(() => {
  getPrefs().then(({ intervalMinutes }) => scheduleAlarm(intervalMinutes))
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return
  void fireReminder()
})

async function fireReminder(): Promise<void> {
  const prefs = await getPrefs()

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  const tab  = tabs[0]
  if (tab && tab.id !== undefined) {
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TOAST', prefs }).catch(() => {
      // Tab may not have a content script (e.g., chrome:// pages). Fall back to native notification.
    })
  }

  chrome.notifications.create({
    type:     'basic',
    iconUrl:  'icons/icon128.png',
    title:    prefs.titleText,
    message:  prefs.messageText,
    priority: 1,
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_ALARM') {
    const { intervalMinutes } = message.payload as { intervalMinutes: number }
    chrome.alarms.clear(ALARM_NAME, () => {
      scheduleAlarm(intervalMinutes)
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'OPEN_SETTINGS_TAB') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/settings/index.html') })
  }

  if (message.type === 'TEST_TOAST') {
    const tabId = sender.tab?.id
    if (tabId !== undefined) {
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOAST', prefs: message.prefs }).catch(() => {})
    }
  }
})

function scheduleAlarm(intervalMinutes: number) {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes:  intervalMinutes,
    periodInMinutes: intervalMinutes,
  })
}
