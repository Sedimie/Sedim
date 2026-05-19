'use client'

import { LoginForm } from '@/sedim/auth/ui/auth-client'

export default function LoginPage() {
  return (
    <main className="sedim-auth-page">
      <div className="sedim-auth-card" style={{ margin: 'auto', padding: '2.5rem', maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--auth-fg)', marginBottom: '0.25rem', fontFamily: 'var(--auth-font-family)' }}>Sign in</h1>
          <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)' }}>Enter your credentials to access your account.</p>
        </div>
        <LoginForm />
        <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)', marginTop: '1.5rem', textAlign: 'center', fontFamily: 'var(--auth-font-family)' }}>
          Don&apos;t have an account? <a href="/signup" style={{ color: 'var(--auth-btn-bg)', textDecoration: 'none' }}>Create one</a>
        </p>
      </div>
    </main>
  )
}