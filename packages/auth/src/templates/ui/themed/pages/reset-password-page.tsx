'use client'

import { ResetPasswordForm } from '@/sedim/auth/ui/auth-client'

export default function ResetPasswordPage() {
  return (
    <main className="sedim-auth-page">
      <div className="sedim-auth-card" style={{ margin: 'auto', padding: '2.5rem', maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--auth-fg)', marginBottom: '0.25rem', fontFamily: 'var(--auth-font-family)' }}>Set new password</h1>
          <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)' }}>Choose a strong password for your account.</p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  )
}