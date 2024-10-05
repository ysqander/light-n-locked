'use client'

import ResetPasswordForm from '@/components/ResetPasswordform'
import { useParams } from 'next/navigation' // Import useParams to access URL parameters
import { resetPassword } from '@/app/(login)/reset-password/[token]/actions' // Ensure correct import
import { useActionState, startTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import Head from 'next/head'

export default function ResetPasswordPage() {
  const params = useParams()
  const { token } = params

  type ActionState = {
    error?: string
    success?: string
  }

  type ResetPasswordFormProps = {
    token: string
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
                maxLength={100}
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
                maxLength={100}
              />
            </div>
            {resetState.error && (
              <p className="text-red-500 text-sm">{resetState.error}</p>
            )}
            {resetState.success && (
              <p className="text-green-500 text-sm">{resetState.success}</p>
            )}
            <Button type="submit" disabled={isResetPending}>
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
