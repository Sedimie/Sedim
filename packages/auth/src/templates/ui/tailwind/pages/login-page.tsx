'use client'

import { LoginForm } from '@/sedim/auth/ui/auth-client'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your credentials to access your account.</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-sm text-gray-500 text-center">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-indigo-600 hover:text-indigo-500 font-medium">Create one</a>
        </p>
      </div>
    </main>
  )
}