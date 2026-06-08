import type { ReactNode } from 'react'

type VideoFrameProps = {
  label: string
  children: ReactNode
  variant?: 'light' | 'dark'
}

export function VideoFrame({ label, children, variant = 'dark' }: VideoFrameProps) {
  return (
    <div className={`video-showcase video-showcase-${variant}`}>
      <div className="video-showcase-chrome">
        <div className="video-showcase-dots" aria-hidden="true">
          <span className="terminal-dot terminal-dot-red" />
          <span className="terminal-dot terminal-dot-yellow" />
          <span className="terminal-dot terminal-dot-green" />
        </div>
        <span className="video-showcase-label">{label}</span>
      </div>
      <div className="video-showcase-stage">{children}</div>
    </div>
  )
}
