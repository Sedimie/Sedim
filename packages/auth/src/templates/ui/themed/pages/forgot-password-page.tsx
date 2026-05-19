'use client'

import { ForgotPasswordForm } from '@/sedim/auth/ui/auth-client'

export default function ForgotPasswordPage() {
  return (
    <main className="sedim-auth-page">
      <div className="sedim-auth-card" style={{ margin: 'auto', padding: '2.5rem', maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--auth-fg)', marginBottom: '0.25rem', fontFamily: 'var(--auth-font-family)' }}>Reset password</h1>
          <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)' }}>Enter your email and we&apos;ll send you a reset link.</p>
        </div>
        <ForgotPasswordForm />
        <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)', marginTop: '1.5rem', textAlign: 'center', fontFamily: 'var(--auth-font-family)' }}>
          Remember your password? <a href="/login" style={{ color: 'var(--auth-btn-bg)', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </main>
  )
}