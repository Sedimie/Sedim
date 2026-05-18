import '@/sedim/auth/ui/tokens.css'
import '@/sedim/auth/ui/tokens.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
