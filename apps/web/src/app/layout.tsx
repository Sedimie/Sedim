import '../styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sedim - Install complete features. Own every line.',
  description: 'A CLI that stamps production-ready feature modules into your project. No runtime dependency, no black box — every file is yours.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}