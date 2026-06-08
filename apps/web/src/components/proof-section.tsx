import Image from 'next/image'
import { ScrollReveal } from '~/components/motion'
import { SectionHeading } from '~/components/section-heading'
import { ShowbabyPlan } from '~/components/showbaby-plan'
import { StampedTree } from '~/components/stamped-tree'
import { engineeringHighlights, workspaceMoments } from '~/lib/site-data'

export function ProofSection() {
  const diagram = workspaceMoments[0]

  return (
    <section id="proof" className="section section-proof">
      <div className="container">
        <ScrollReveal>
          <SectionHeading
            label="Proof, not promises"
            title={
              <>
                See the plan. <span className="display-italic">Read the code.</span>
              </>
            }
            description="Showbaby previews every file, dependency, and conflict before writing. What lands in your repo is production-grade source, not a runtime SDK."
          />
        </ScrollReveal>

        <div className="proof-grid">
          <ScrollReveal delay={60}>
            <ShowbabyPlan />
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <StampedTree />
          </ScrollReveal>

          <ScrollReveal delay={180} className="proof-diagram-wrap">
            <figure className="proof-diagram doodle-card">
              <div className="proof-diagram-header">
                <span className="proof-diagram-label">{diagram.label}</span>
              </div>
              <div className="proof-diagram-image workspace-image-wrap-diagram">
                <Image
                  src={diagram.image}
                  alt="Sedim CLI architecture: registry fetch, thinker plan, writer stamp into src/sedim"
                  width={1200}
                  height={680}
                  className="workspace-image"
                />
              </div>
              <figcaption className="proof-diagram-caption">{diagram.caption}</figcaption>
            </figure>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={100}>
          <ul className="engineering-highlights">
            {engineeringHighlights.map((item, i) => (
              <li key={item.title} className="engineering-highlight doodle-card" style={{ ['--card-rotate' as string]: `${((i % 4) - 1.5) * 0.12}deg` }}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  )
}
