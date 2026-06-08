import { SiteFooter } from '~/components/site-footer'
import { SiteHeader } from '~/components/site-header'

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader active="guides" />
      {children}
      <SiteFooter />
    </>
  )
}
