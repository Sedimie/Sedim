'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Brand } from '~/components/brand'
import { navLinks } from '~/lib/site-data'

type SiteHeaderProps = {
  active?: 'docs' | 'guides' | 'reference' | 'blog'
}

export function SiteHeader({ active }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container header-inner">
        <Brand />

        <nav className="header-nav" aria-label="Primary">
          {navLinks.map(link => {
            const isActive =
              'activeKey' in link && link.activeKey === active

            if ('external' in link && link.external) {
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className="header-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              )
            }

            return (
              <Link
                key={link.label}
                href={link.href}
                className={`header-link${isActive ? ' is-active' : ''}`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="header-actions">
          <a href="/#install" className="btn btn-primary btn-sm header-install">
            Install CLI
          </a>
        </div>
      </div>
    </header>
  )
}
