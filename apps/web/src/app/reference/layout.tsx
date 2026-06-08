import { SiteFooter } from '~/components/site-footer'
import { SiteHeader } from '~/components/site-header'

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader active="reference" />
      {children}
      <SiteFooter />
    </>
  )
}
