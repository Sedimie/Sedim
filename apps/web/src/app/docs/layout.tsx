import { SiteHeader } from '~/components/site-header'
import { SiteFooter } from '~/components/site-footer'
import { DocsSidebar } from '~/components/docs-sidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader active="docs" />
      <div className="docs-layout">
        <DocsSidebar />
        <div className="docs-main">{children}</div>
      </div>
      <SiteFooter />
    </>
  )
}
