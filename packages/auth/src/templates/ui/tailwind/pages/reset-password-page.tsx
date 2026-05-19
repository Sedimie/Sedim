'use client'

import { ResetPasswordForm } from '@/sedim/auth/ui/auth-client'

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Set new password</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a strong password for your account.</p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  )
}