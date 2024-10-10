'use client'

import { useParams, useRouter } from 'next/navigation' // Import useParams to access URL parameters
import { resetPassword } from '@/app/(account)/reset-pass-old/[token]/actions' // Ensure correct import
import { useActionState, startTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import Head from 'next/head'
import { useEffect, useState } from 'react'

export default function ResetPasswordPage() {
  const params = useParams()
  const { token } = params
  const router = useRouter()
  type ActionState = {
    error?: string
    success?: string
  }

  const [resetState, resetAction, isResetPending] = useActionState<
    ActionState,
    FormData
  >(resetPassword, { error: '', success: '' })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => {
      resetAction(formData)
    })
  }

  useEffect(() => {
    if (resetState.success) {
      // Navigate to dashboard after a short delay
      const timer = setTimeout(() => {
        router.push('/dashboard')
      }, 3000) // 2 seconds delay

      return () => clearTimeout(timer)
    }
  }, [resetState.success])

  return (
    <div>
      <Head>
        <meta name="referrer" content="strict-origin" />
      </Head>
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium bold text-gray-900 mb-6">
          Reset Your Password
        </h1>
        <div>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <input type="hidden" name="token" value={token} />{' '}
            {/* Hidden token field */}
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={30}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                maxLength={30}
                className="w-full"
              />
            </div>
            {resetState.error && (
              <p className="text-red-500 text-sm">{resetState.error}</p>
            )}
            {resetState.success && (
              <div>
                <p className="text-green-500 text-sm">{resetState.success}</p>
                <p className="text-black-500 text-sm">
                  {resetState.success} Redirecting to dashboard...
                </p>
              </div>
            )}
            <Button
              type="submit"
              disabled={isResetPending || !!resetState.success}
            >
              {isResetPending ? (
                <div>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </div>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
