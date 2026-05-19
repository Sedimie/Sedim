'use client'

import { ForgotPasswordForm } from '@/sedim/auth/ui/auth-client'

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Reset password</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your email and we&apos;ll send you a reset link.</p>
        </div>
        <ForgotPasswordForm />
        <p className="mt-6 text-sm text-gray-500 text-center">
          Remember your password?{' '}
          <a href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">Sign in</a>
        </p>
      </div>
    </main>
  )
}