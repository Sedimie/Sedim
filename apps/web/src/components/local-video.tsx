'use client'

import { VideoFrame } from '~/components/video-frame'

interface LocalVideoProps {
  src: string
  title: string
  label?: string
  poster?: string
}

export function LocalVideo({ src, title, label, poster }: LocalVideoProps) {
  return (
    <VideoFrame label={label ?? title} variant="dark">
      <video
        className="video-showcase-player"
        controls
        controlsList="nodownload"
        preload="metadata"
        poster={poster}
        title={title}
        playsInline
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </VideoFrame>
  )
}
