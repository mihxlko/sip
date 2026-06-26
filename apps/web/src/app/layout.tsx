import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
