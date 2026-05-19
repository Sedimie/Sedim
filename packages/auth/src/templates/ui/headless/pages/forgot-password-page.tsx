'use client'

import { ForgotPasswordForm } from './auth-client'

export default function ForgotPasswordPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem', color: '#111827' }}>Reset password</h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '2rem' }}>Enter your email and we&apos;ll send you a reset link.</p>
        <ForgotPasswordForm />
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '1.5rem', textAlign: 'center' }}>
          Remember your password? <a href="/login" style={{ color: '#4f46e5', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </main>
  )
}