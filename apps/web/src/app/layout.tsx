import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import DevAnnotation from '../components/DevAnnotation'

export const metadata: Metadata = {
  title: 'SIP — Settings',
  description: 'A smart water drinking reminder — stay hydrated throughout your day.',
  icons: {
    icon: [
      { url: '/icons/sip-icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/sip-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/sip-icon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/sip-icon-128.png', sizes: '128x128', type: 'image/png' },
    ],
  },
}

// Preloaded, not just @font-face'd. Without this the browser cannot discover
// the font until it has fetched and parsed globals.css and laid out enough to
// know the face is needed — measured at ~370ms on a warm local dev server, and
// the whole of that window renders in the fallback. The preload moves the
// request to head-parse time so it races the stylesheet instead of queueing
// behind it.
//
// `crossOrigin` is required even though these are same-origin: font fetches are
// always CORS-mode, and a preload whose CORS mode doesn't match the eventual
// @font-face request is discarded and re-fetched, which is worse than no
// preload at all. All three weights are listed because all three are used
// (font-normal/-medium/-semibold); adding a weight to the design system without
// adding it here reintroduces the swap for that weight alone.
const FONT_PRELOADS = [
  '/fonts/SF-Pro-Rounded-Regular.woff2',
  '/fonts/SF-Pro-Rounded-Medium.woff2',
  '/fonts/SF-Pro-Rounded-Semibold.woff2',
]

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {FONT_PRELOADS.map(href => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>
        {children}
        {/* Renders nothing outside `next dev` — see DevAnnotation. */}
        <DevAnnotation />
      </body>
    </html>
  )
}
