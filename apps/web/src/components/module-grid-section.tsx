import Link from 'next/link'
import { ScrollReveal } from '~/components/motion'
import { SectionHeading } from '~/components/section-heading'
import { modules } from '~/lib/site-data'

export function ModuleGridSection() {
  return (
    <section id="modules" className="section section-modules">
      <div className="container">
        <ScrollReveal>
          <SectionHeading
            label="Modules"
            title={
              <>
                One command. <span className="display-italic">Full vertical slice.</span>
              </>
            }
            description="Each module stamps backend logic, schema, adapters, and UI into your repo. Framework and DB agnostic, three UI tiers per module."
          />
        </ScrollReveal>

        <div className="module-grid">
          {modules.map((mod, i) => (
            <ScrollReveal key={mod.command} delay={i * 60}>
              <article
                className={`module-card doodle-card${mod.status === 'available' ? ' module-card-available' : ' module-card-soon'}`}
                style={{ ['--card-rotate' as string]: `${((i % 3) - 1) * 0.15}deg` }}
              >
                <div className="module-card-top">
                  <code className="module-card-cmd">{mod.command}</code>
                  <span className="module-card-category">{mod.category}</span>
                </div>
                <p className="module-card-desc">{mod.description}</p>
                {mod.status === 'available' && mod.href ? (
                  <Link href={mod.href} className="module-card-link">
                    Start with auth <span className="module-card-arrow">→</span>
                  </Link>
                ) : (
                  <span className="module-card-link">On the roadmap</span>
                )}
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
