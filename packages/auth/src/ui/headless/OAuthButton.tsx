'use client'

import { redirectToOAuth } from './auth-client'

export type OAuthProvider = 'google' | 'github' | 'discord'

export interface OAuthButtonProps {
  provider: OAuthProvider
  /** Override the default label. Defaults to "Continue with {Provider}". */
  label?: string
  disabled?: boolean
}

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
  discord: 'Continue with Discord',
}

export function OAuthButton({ provider, label, disabled }: OAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={() => redirectToOAuth(provider)}
      disabled={disabled}
    >
      {label ?? PROVIDER_LABELS[provider]}
    </button>
  )
}
