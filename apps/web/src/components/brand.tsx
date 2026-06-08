import Image from 'next/image'
import Link from 'next/link'

type BrandProps = {
  size?: 'header' | 'footer'
  className?: string
}

const LOGO_SIZES = {
  header: 80,
  footer: 120,
} as const

export function Brand({ size = 'header', className = '' }: BrandProps) {
  const logoSize = LOGO_SIZES[size]

  return (
    <Link
      href="/"
      className={`brand brand-${size} ${className}`.trim()}
      style={{ ['--brand-logo-size' as string]: `${logoSize}px` }}
    >
      <span className="brand-logo-wrap">
        <Image
          src="/logo.png"
          alt="sedim"
          width={logoSize}
          height={logoSize}
          className="brand-logo"
          priority={size === 'header'}
          quality={95}
        />
      </span>
      <span className="brand-name">sedim</span>
    </Link>
  )
}
