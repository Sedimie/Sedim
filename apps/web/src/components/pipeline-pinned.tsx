'use client'

import { useEffect, useRef, useState } from 'react'
import { pipelineStages } from '~/lib/site-data'

export function PipelinePinned() {
  const pinRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const pin = pinRef.current
    if (!pin) return

    function onScroll() {
      if (!pin) return
      const rect = pin.getBoundingClientRect()
      const scrollRange = pin.offsetHeight - window.innerHeight
      if (scrollRange <= 0) return

      const progress = Math.max(0, Math.min(1, -rect.top / scrollRange))
      const stage = Math.min(
        pipelineStages.length - 1,
        Math.floor(progress * pipelineStages.length),
      )
      setActive(stage)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div
      ref={pinRef}
      className="pipeline-pin"
      style={{ ['--pipeline-steps' as string]: pipelineStages.length }}
    >
      <div className="pipeline-pin-sticky">
        <div className="pipeline-pin-header">
          <p className="eyebrow">The pipeline</p>
          <h2 className="section-title pipeline-pin-title">
            Four stages, <span className="display-italic">one keystroke.</span>
          </h2>
          <p className="section-description pipeline-pin-desc">
            Scroll to walk through each stage. Every command runs through all four before a single
            file is written.
          </p>
        </div>

        <div className="pipeline-pin-track" aria-hidden="true">
          <div
            className="pipeline-pin-track-fill"
            style={{
              width: active >= 0 ? `${((active + 1) / pipelineStages.length) * 100}%` : '0%',
            }}
          />
        </div>

        <div className="pipeline-pin-grid">
          {pipelineStages.map((stage, i) => (
            <article
              key={stage.num}
              className={`pipeline-pin-card${i <= active ? ' is-lit' : ''}${i === active ? ' is-current' : ''}`}
            >
              <div className="pipeline-pin-num">{stage.num}</div>
              <h3 className="pipeline-pin-card-title">{stage.title}</h3>
              <p className="pipeline-pin-card-desc">{stage.description}</p>
            </article>
          ))}
        </div>

        <p className="pipeline-pin-hint" aria-hidden="true">
          {active < pipelineStages.length - 1 ? 'Keep scrolling ↓' : 'All stages complete ✓'}
        </p>
      </div>
    </div>
  )
}
