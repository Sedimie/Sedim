import Image from 'next/image'
import Link from 'next/link'
import { Brand } from '~/components/brand'
import { footerColumns } from '~/lib/site-data'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-banner" aria-hidden="true">
        <Image
          src="/footer1.jpg"
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 1400px"
          quality={92}
          className="footer-banner-image"
          priority={false}
        />
        <div className="footer-banner-overlay" />
      </div>

      <div className="footer-content">
        <p className="footer-freewill display-italic">free will</p>

        <div className="container footer-grid">
          <div className="footer-brand-col">
            <Brand size="footer" className="brand-on-dark" />
            <p className="footer-tagline">
              Precision tooling for modern engineering teams. Built for codebases that already exist,
              and the people who maintain them.
            </p>
            <div className="status-pill">
              <span className="status-dot" aria-hidden="true" />
              All systems operational
            </div>
          </div>

          {footerColumns.map(col => (
            <div key={col.title} className="footer-col">
              <h3 className="footer-col-title">{col.title}</h3>
              <ul className="footer-col-links">
                {col.links.map(link =>
                  'external' in link && link.external ? (
                    <li key={link.label}>
                      <a href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="container footer-bottom">
          <span className="footer-copy">© 2026 sedim systems</span>
          <span className="footer-motto">
            Crafted for engineers who <em>read diffs</em>.
          </span>
        </div>
      </div>
    </footer>
  )
}
