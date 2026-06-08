'use client'

import { useEffect, useState } from 'react'
import { terminalLines } from '~/lib/site-data'

const LINE_HEIGHT = 1.85
const FONT_SIZE = 0.8125

export function AnimatedTerminal() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [showCursor, setShowCursor] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (visibleCount >= terminalLines.length) {
      setDone(true)
      const blink = setInterval(() => setShowCursor(c => !c), 530)
      return () => clearInterval(blink)
    }

    const delay = terminalLines[visibleCount]?.type === 'command' ? 420 : 180
    const timer = setTimeout(() => setVisibleCount(c => c + 1), delay)
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <div
      className="terminal-window terminal-window-animated"
      role="img"
      aria-label="Sedim CLI demonstration"
      style={{
        // Reserve full height up front so nothing below shifts
        ['--terminal-lines' as string]: terminalLines.length,
      }}
    >
      <div className="terminal-chrome">
        <div className="terminal-dots-group">
          <span className="terminal-dot terminal-dot-red" />
          <span className="terminal-dot terminal-dot-yellow" />
          <span className="terminal-dot terminal-dot-green" />
        </div>
        <span className="terminal-title">sedim - zsh</span>
      </div>
      <div className="terminal-body terminal-body-fixed">
        {terminalLines.map((line, i) => (
          <div
            key={i}
            className={`terminal-line terminal-line-${line.type}${i < visibleCount ? ' is-shown' : ' is-pending'}`}
            aria-hidden={i >= visibleCount}
          >
            {line.text}
          </div>
        ))}
        {!done && showCursor && (
          <span className="terminal-cursor terminal-cursor-inline" aria-hidden="true">
            ▋
          </span>
        )}
      </div>
    </div>
  )
}

export const TERMINAL_MIN_HEIGHT = `calc(${terminalLines.length} * ${LINE_HEIGHT} * ${FONT_SIZE}rem + 0.5rem)`
