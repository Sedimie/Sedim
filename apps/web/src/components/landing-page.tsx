'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AnimatedTerminal } from '~/components/animated-terminal'
import { CommandTicker } from '~/components/command-ticker'
import { InstallBar } from '~/components/install-bar'
import { LocalVideo } from '~/components/local-video'
import { ModuleGridSection } from '~/components/module-grid-section'
import { ScrollProgress, ScrollReveal } from '~/components/motion'
import { PipelinePinned } from '~/components/pipeline-pinned'
import { ProofSection } from '~/components/proof-section'
import { SectionHeading } from '~/components/section-heading'
import { SiteFooter } from '~/components/site-footer'
import { SiteHeader } from '~/components/site-header'
import { VideoEmbed } from '~/components/video-embed'
import { initAnimations } from '~/lib/animation'
import {
  audiences,
  authFeatures,
  authRoadmap,
  commands,
  comparisons,
  heroTagline,
  philosophyPillars,
  stackSupport,
  uiTiers,
  workflowSteps,
  YOUTUBE_WALKTHROUGH_ID,
} from '~/lib/site-data'

export function LandingPage() {
  useEffect(() => {
    initAnimations()
  }, [])

  return (
    <>
      <ScrollProgress />
      <SiteHeader />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-bg-grid" />
          <span className="hero-deco hero-deco-1" aria-hidden="true">⚡</span>
          <span className="hero-deco hero-deco-2" aria-hidden="true">📦</span>
          <span className="hero-deco hero-deco-3" aria-hidden="true">✦</span>
        </div>

        <div className="container hero-content">
          <ScrollReveal>
            <div className="hero-badge">
              <span className="hero-badge-dot" aria-hidden="true" />
              Open source · Stamping model · Zero runtime dependency
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <h1 className="hero-title">
              <span className="hero-title-line">
                {heroTagline.line.split(' ').map((word, i) => (
                  <span key={`${word}-${i}`} className="hero-title-word">
                    {word}
                  </span>
                ))}
              </span>
              <span className="display-italic hero-title-accent hero-title-word">
                {heroTagline.accent}
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <p className="hero-kicker hero-animate-line">{heroTagline.kicker}</p>
          </ScrollReveal>

          <ScrollReveal delay={160}>
            <p className="hero-subtitle hero-animate-line">{heroTagline.subtitle}</p>
          </ScrollReveal>

          <ScrollReveal delay={240}>
            <div className="hero-actions">
              <span className="hero-animate-action">
                <InstallBar id="install" />
              </span>
              <Link href="/docs" className="text-link text-link-arrow hero-animate-action">
                Read the docs
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={320} className="hero-terminal-wrap">
            <div className="hero-terminal">
              <AnimatedTerminal />
            </div>
          </ScrollReveal>
        </div>
      </section>

      <CommandTicker />

      {/* ── Comparison (killer differentiator — early) ── */}
      <section id="compare" className="section section-compare">
        <div className="container">
          <ScrollReveal>
            <SectionHeading
              label="How sedim differs"
              title={
                <>
                  Same problem space. <span className="display-italic">Different model.</span>
                </>
              }
              description="Runtime SDKs, headless libraries, UI kits, and AI codegen each solve part of the puzzle. Sedim targets the full vertical slice: backend, schema, and UI, as owned, editable code."
            />
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className="compare-table-wrap doodle-card">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Approach</th>
                    <th>Examples</th>
                    <th>Ownership</th>
                    <th>Customization</th>
                    <th>Runtime lock-in</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(row => (
                    <tr key={row.approach} className={row.sedim ? 'compare-row-sedim' : ''}>
                      <td><strong>{row.approach}</strong></td>
                      <td>{row.examples}</td>
                      <td>{row.ownership}</td>
                      <td>{row.customization}</td>
                      <td>{row.lockIn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Philosophy ── */}
      <section id="philosophy" className="section section-philosophy">
        <div className="container">
          <ScrollReveal>
            <SectionHeading
              label="The stamp model"
              title={
                <>
                  The 80% is repetitive.{' '}
                  <span className="display-italic">Ship the 20%.</span>
                </>
              }
              description="Standardized, secure boilerplate for full-stack features, stamped into your project, not imported at runtime."
            />
          </ScrollReveal>

          <div className="philosophy-grid">
            {philosophyPillars.map((pillar, i) => (
              <ScrollReveal key={pillar.title} delay={i * 80}>
                <article
                  className="philosophy-card doodle-card"
                  style={{ ['--card-rotate' as string]: `${((i % 3) - 1) * 0.18}deg` }}
                >
                  <span className="philosophy-index">0{i + 1}</span>
                  <h3 className="philosophy-title">{pillar.title}</h3>
                  <p className="philosophy-desc">{pillar.description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <ProofSection />
      <ModuleGridSection />

      {/* ── Pipeline (pinned scroll) ── */}
      <section id="pipeline" className="section-pipeline-wrap">
        <PipelinePinned />
      </section>

      {/* ── How it works (workflow + walkthrough merged) ── */}
      <section id="workflow" className="section section-workflow">
        <div className="container">
          <ScrollReveal>
            <SectionHeading
              label="How it works"
              title={
                <>
                  Init to running. <span className="display-italic">Four steps.</span>
                </>
              }
              description="Detection, feature selection, plan review, stamping, migrations, and running code. Use plan, diff, or --dry-run when you want to preview first."
            />
          </ScrollReveal>

          <div className="workflow-steps">
            {workflowSteps.map((step, i) => (
              <ScrollReveal key={step.step} delay={i * 80}>
                <article
                  className="workflow-step doodle-card"
                  style={{ ['--card-rotate' as string]: `${((i % 4) - 1.5) * 0.14}deg` }}
                >
                  <span className="workflow-step-num">{step.step}</span>
                  <h3 className="workflow-step-title">{step.title}</h3>
                  <code className="workflow-step-cmd">{step.cmd}</code>
                  <p className="workflow-step-desc">{step.description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={120}>
            <div className="workflow-video">
              <VideoEmbed
                videoId={YOUTUBE_WALKTHROUGH_ID}
                title="Sedim full walkthrough - init, auth, OAuth, TOTP, and customization"
                label="Full walkthrough · 13 min"
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Stack + UI tiers ── */}
      <section id="stack" className="section section-stack">
        <div className="container">
          <ScrollReveal>
            <SectionHeading
              label="Framework & DB agnostic"
              title={
                <>
                  Your stack. <span className="display-italic">Your rules.</span>
                </>
              }
              description={stackSupport.note}
            />
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <div className="stack-table-wrap doodle-card">
              <table className="stack-table">
                <thead>
                  <tr>
                    <th>Framework</th>
                    <th>Scope</th>
                    <th>Drizzle</th>
                    <th>Prisma</th>
                  </tr>
                </thead>
                <tbody>
                  {stackSupport.frameworks.map(fw => (
                    <tr key={fw.name}>
                      <td><strong>{fw.name}</strong></td>
                      <td>{fw.note}</td>
                      <td className="stack-check">✓</td>
                      <td className="stack-check">✓</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div className="ui-tiers-section">
              <h3 className="ui-tiers-heading">
                Three UI tiers per module,{' '}
                <span className="display-italic">just like shadcn</span>
              </h3>
              <div className="tier-cards">
                {uiTiers.map((tier, i) => (
                  <ScrollReveal key={tier.tier} delay={i * 70}>
                    <article
                      className="tier-card doodle-card"
                      style={{ ['--card-rotate' as string]: `${((i % 3) - 1) * 0.16}deg` }}
                    >
                      <span className="tier-card-name">{tier.tier}</span>
                      <p className="tier-card-tagline">{tier.tagline}</p>
                      <p className="tier-card-desc">{tier.description}</p>
                    </article>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Auth spotlight ── */}
      <section id="auth" className="section section-auth">
        <div className="container">
          <ScrollReveal>
            <SectionHeading
              label="Auth module, shipping now"
              title={
                <>
                  Production-grade security.{' '}
                  <span className="display-italic">Readable code.</span>
                </>
              }
              description="The first module. Every feature below is stamped as source you own: Argon2id, PKCE S256, encrypted TOTP, non-enumerating magic links, and explicit scalability tradeoffs."
            />
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <div className="auth-features-grid doodle-card">
              {authFeatures.map(f => (
                <div key={f.name} className="auth-feature-row">
                  <span className="auth-feature-name">{f.name}</span>
                  <span className="auth-feature-detail">{f.detail}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div className="auth-roadmap-box doodle-card">
              <h3 className="auth-roadmap-title">Auth roadmap</h3>
              <ul className="auth-roadmap-list">
                {authRoadmap.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── CLI demos ── */}
      <section id="demos" className="section section-demos">
        <div className="container">
          <ScrollReveal>
            <SectionHeading
              label="See the CLI"
              title={
                <>
                  Smart detection. <span className="display-italic">Eight commands.</span>
                </>
              }
              description="Detects conflicts, empty workspaces, and existing auth libraries before writing. Every command is predictable: init, add, plan, diff, continue, doctor, and --dry-run."
            />
          </ScrollReveal>

          <div className="demos-grid">
            <ScrollReveal delay={80}>
              <LocalVideo
                src="/conflictHandler.mp4"
                title="Sedim smart detection - conflicts, empty workspaces, backend-only projects"
                label="Smart detection demo"
              />
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <LocalVideo
                src="/sedimCommands.mp4"
                title="Sedim CLI commands walkthrough"
                label="CLI commands demo"
              />
            </ScrollReveal>
          </div>

          <ScrollReveal delay={160}>
            <div className="command-list">
              {commands.map(cmd => (
                <div key={cmd.cmd} className="command-row">
                  <code className="command-row-cmd">$ {cmd.cmd}</code>
                  <span className="command-row-desc">{cmd.description}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section id="audience" className="section section-audience">
        <div className="container">
          <ScrollReveal>
            <SectionHeading
              label="Who it's for"
              title={
                <>
                  Built for people who <span className="display-italic">read diffs.</span>
                </>
              }
              description="Hackathon tonight or enterprise audit tomorrow. Sedim meets you in the codebase you already have."
            />
          </ScrollReveal>

          <div className="audience-grid">
            {audiences.map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 80}>
                <article
                  className="audience-card"
                  style={{ ['--card-rotate' as string]: `${((i % 4) - 1.5) * 0.1}deg` }}
                >
                  <span className="audience-label">{item.label}</span>
                  <h3 className="audience-title">{item.title}</h3>
                  <p className="audience-desc">{item.description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote CTA ── */}
      <section className="quote-section">
        <div className="container">
          <ScrollReveal>
            <p className="eyebrow">Why sedim exists</p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <blockquote className="quote-text">
              Generators give you a template. Sedim gives you a teammate who already understood the
              repo before opening the file.
            </blockquote>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="quote-actions">
              <InstallBar variant="hero" />
              <Link href="/docs" className="btn btn-primary btn-lg btn-magnetic">
                Explore the docs
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
