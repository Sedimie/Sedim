'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { docsNav } from '~/lib/site-data'

export function DocsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="docs-sidebar">
      {docsNav.map(section => (
        <div key={section.title} className="docs-sidebar-section">
          <h3 className="docs-sidebar-title">{section.title}</h3>
          <ul className="docs-sidebar-links">
            {section.links.map(link => {
              const isActive = pathname === link.href
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`docs-sidebar-link${isActive ? ' is-active' : ''}`}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </aside>
  )
}
