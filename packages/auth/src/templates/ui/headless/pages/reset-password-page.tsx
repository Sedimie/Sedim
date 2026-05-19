'use client'

import { ResetPasswordForm } from './auth-client'

export default function ResetPasswordPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem', color: '#111827' }}>Set new password</h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '2rem' }}>Choose a strong password for your account.</p>
        <ResetPasswordForm />
      </div>
    </main>
  )
}