'use client'

import { LoginForm } from './auth-client'

export default function LoginPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem', color: '#111827' }}>Sign in</h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '2rem' }}>Enter your credentials to access your account.</p>
        <LoginForm />
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '1.5rem', textAlign: 'center' }}>
          Don&apos;t have an account? <a href="/signup" style={{ color: '#4f46e5', textDecoration: 'none' }}>Create one</a>
        </p>
      </div>
    </main>
  )
}