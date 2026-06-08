import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'sedim - Install complete features. Own every line.',
    template: '%s · sedim',
  },
  description:
    'A context-aware CLI that stamps production-ready full-stack modules into your codebase. No runtime dependency, no black box - every file is yours.',
  openGraph: {
    title: 'sedim',
    description: 'The surgical CLI for module injection.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
