import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sedim',
  description: 'Install complete features. Own every line.',
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