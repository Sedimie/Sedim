'use client'

import { redirectToOAuth } from './auth-client'

export type OAuthProvider = 'google' | 'github' | 'discord'

export interface OAuthButtonProps {
  provider: OAuthProvider
  label?: string
  disabled?: boolean
}

const LABELS: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
  discord: 'Continue with Discord',
}

const btnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  width: '100%',
  borderRadius: 'var(--auth-radius)',
  border: '1px solid var(--auth-border)',
  background: 'var(--auth-input-bg)',
  color: 'var(--auth-fg)',
  padding: '0.5rem 1rem',
  fontSize: 'var(--auth-font-size-sm)',
  fontWeight: 500,
  cursor: 'pointer',
}

export function OAuthButton({ provider, label, disabled }: OAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={() => redirectToOAuth(provider)}
      disabled={disabled}
      style={{ ...btnStyle, opacity: disabled ? 0.5 : 1 }}
    >
      {label ?? LABELS[provider]}
    </button>
  )
}
