import { CopyButton } from '~/components/copy-button'
import { INSTALL_CMD } from '~/lib/site-data'

type InstallBarProps = {
  id?: string
  variant?: 'hero' | 'banner' | 'cta'
}

export function InstallBar({ id, variant = 'hero' }: InstallBarProps) {
  return (
    <div id={id} className={`install-bar install-bar-${variant}`}>
      <code className="install-bar-cmd">
        <span className="install-bar-prefix">$</span> {INSTALL_CMD}
      </code>
      <CopyButton text={INSTALL_CMD} />
    </div>
  )
}
