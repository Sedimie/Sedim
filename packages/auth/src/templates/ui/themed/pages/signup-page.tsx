'use client'

import { SignupForm } from '@/sedim/auth/ui/auth-client'

export default function SignupPage() {
  return (
    <main className="sedim-auth-page">
      <div className="sedim-auth-card" style={{ margin: 'auto', padding: '2.5rem', maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--auth-fg)', marginBottom: '0.25rem', fontFamily: 'var(--auth-font-family)' }}>Create account</h1>
          <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)' }}>Start by creating your account.</p>
        </div>
        <SignupForm />
        <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)', marginTop: '1.5rem', textAlign: 'center', fontFamily: 'var(--auth-font-family)' }}>
          Already have an account? <a href="/login" style={{ color: 'var(--auth-btn-bg)', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </main>
  )
}