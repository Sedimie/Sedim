'use client'

import { SignupForm } from '@/sedim/auth/ui/auth-client'

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">Start by creating your account.</p>
        </div>
        <SignupForm />
        <p className="mt-6 text-sm text-gray-500 text-center">
          Already have an account?{' '}
          <a href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">Sign in</a>
        </p>
      </div>
    </main>
  )
}