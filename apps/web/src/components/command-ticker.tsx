'use client'

import { useEffect, useState } from 'react'

const ticks = [
  {
    cmd: 'sedim plan auth',
    desc: 'Preview exactly what will be stamped: files, migrations, env vars, before writing anything.',
  },
  {
    cmd: 'sedim diff auth',
    desc: 'See per-file diffs of every change before a single byte hits disk.',
  },
  {
    cmd: 'sedim doctor',
    desc: 'Validate your setup and catch issues before you stamp.',
  },
  {
    cmd: 'sedim add auth --dry-run',
    desc: 'Full interactive flow with zero writes. Review everything first.',
  },
] as const

export function CommandTicker() {
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % ticks.length)
        setFade(true)
      }, 280)
    }, 4200)
    return () => clearInterval(interval)
  }, [])

  const tick = ticks[index]

  return (
    <div className="command-banner">
      <div className="container command-banner-inner">
        <code className={`command-banner-cmd${fade ? ' is-visible' : ''}`}>$ {tick.cmd}</code>
        <span className={`command-banner-desc${fade ? ' is-visible' : ''}`}>{tick.desc}</span>
      </div>
    </div>
  )
}
