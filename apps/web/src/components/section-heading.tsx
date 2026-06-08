import type { ReactNode } from 'react'

type SectionHeadingProps = {
  label: string
  title: ReactNode
  description?: string
  action?: ReactNode
}

export function SectionHeading({ label, title, description, action }: SectionHeadingProps) {
  return (
    <div className={`section-heading${action ? ' has-action' : ''}`}>
      <div className="section-heading-main">
        <p className="eyebrow">{label}</p>
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  )
}
