import { VideoFrame } from '~/components/video-frame'

type VideoEmbedProps = {
  videoId: string
  title: string
  label?: string
}

export function VideoEmbed({ videoId, title, label }: VideoEmbedProps) {
  return (
    <VideoFrame label={label ?? 'YouTube'} variant="dark">
      <iframe
        className="video-showcase-iframe"
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </VideoFrame>
  )
}
