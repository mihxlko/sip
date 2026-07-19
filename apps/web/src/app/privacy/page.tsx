'use client'

import { useEffect } from 'react'
import { type Theme } from '@sip/types'
import { webPlatform } from '../../platform'
import PrivacyHeader from '../../components/PrivacyHeader'

// Same theme application as the home page: reflect the saved pref (and live
// changes) onto <html data-theme> so tokens.css resolves light/dark.
function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'system') html.removeAttribute('data-theme')
  else html.setAttribute('data-theme', theme)
}

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'SIP — Privacy Policy'
    webPlatform.getPrefs().then(p => applyTheme(p.theme))
    return webPlatform.onPrefsChanged(p => applyTheme(p.theme))
  }, [])

  return (
    <div className="w-full max-w-[2240px] mx-auto p-pad-xl box-border">
      <PrivacyHeader />

      {/* centered column, ~700px, cleared below the fixed header */}
      <div className="max-w-[700px] mx-auto flex flex-col gap-gap-md pt-[120px] pb-pad-xxl">
        <h1 className="m-0 text-md font-normal text-text-primary">Privacy Policy</h1>

        <div className="flex flex-col gap-gap-md text-sm text-text-tertiary">
          <p className="m-0">Last updated: July 19, 2026</p>

          <p className="m-0">
            “Sip Hydra” is a Chrome extension that helps you stay hydrated as you work in
            the browser. This policy explains what happens to your information when you use
            it. The short version: Sip does not collect, transmit, sell, or share any
            personal data.
          </p>

          <p className="m-0">
            All of your settings — reminder intervals, bottle style and color, theme, and
            related preferences — are stored locally on your own device using Chrome’s
            storage API. This information never leaves your browser, is never sent to us or
            any third party, and is not tied to your identity.
          </p>

          <p className="m-0">
            SIP requests only the permissions it needs to function: <strong>alarms</strong> to
            schedule your hydration reminders, <strong>notifications</strong> to display them,
            and <strong>storage</strong> to remember your preferences between sessions. To show
            a reminder on top of the page you’re currently viewing, SIP runs a small content
            script — but it never reads, stores, or transmits the content of the web pages you
            visit. None of these permissions are used to gather information about you or your
            browsing activity.
          </p>

          <p className="m-0">
            SIP contains no analytics, no tracking, no advertising, and no third-party
            services. Because your data lives only on your device, you can remove it at any
            time by clearing your browser data or uninstalling the extension.
          </p>

          <p className="m-0">
            If this policy changes, the updated version will be posted on this page with a new
            date above.
          </p>

          <p className="m-0">
            Questions about this policy? Contact us at{' '}
            <a
              href="mailto:a7.mihalko@gmail.com"
              className="font-normal text-text-secondary no-underline hover:text-text-primary transition-colors"
            >
              a7.mihalko@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
