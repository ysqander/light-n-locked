'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Lock, Trash2, Loader2 } from 'lucide-react'
import { startTransition, useActionState } from 'react'
import { deleteAccount, requestPasswordReset } from '@/app/(login)/actions'
import React from 'react' // Added import for React
import { useUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type ActionState = {
  error?: string
  success?: string
}

export default function SecurityPage() {
  // Remove or comment out the password update state
  // const [passwordState, passwordAction, isPasswordPending] = useActionState<
  //   ActionState,
  //   FormData
  // >(updatePassword, { error: '', success: '' })

  // Add state for password reset
  const [resetState, resetAction, isResetPending] = useActionState<
    ActionState,
    FormData
  >(requestPasswordReset, { error: '', success: '' })

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    ActionState,
    FormData
  >(deleteAccount, { error: '', success: '' })

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    // Commenting out the existing password update handler
    /*
    startTransition(() => {
      passwordAction(new FormData(event.currentTarget))
    })
    */
  }

  const handleResetSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => {
      resetAction(new FormData(event.currentTarget))
    })
  }

  const handleDeleteSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    startTransition(() => {
      deleteAction(new FormData(event.currentTarget))
    })
  }

  const { user } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!user) {
      router.push('/sign-in')
    }
  }, [user, router])

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium bold text-gray-900 mb-6">
        Security Settings
      </h1>

      {/* Password Reset Section */}
      {!user?.githubId && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleResetSubmit}>
              <div>
                <Label htmlFor="reset-password"> Email Address</Label>
                <p>Enter the email you signed up with</p>
                <Input
                  id="reset-password"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  minLength={3}
                  maxLength={255}
                />
              </div>
              {resetState.error && (
                <p className="text-red-500 text-sm">{resetState.error}</p>
              )}
              {resetState.success && (
                <p className="text-green-500 text-sm">{resetState.success}</p>
              )}
              <Button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white"
                disabled={isResetPending}
              >
                {isResetPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Commented Out Password Update Section */}
      {/*
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <div>
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
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
            {passwordState.error && (
              <p className="text-red-500 text-sm">{passwordState.error}</p>
            )}
            {passwordState.success && (
              <p className="text-green-500 text-sm">{passwordState.success}</p>
            )}
            <Button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isPasswordPending}
            >
              {isPasswordPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      */}

      {/* Delete Account Section */}
      <Card>
        <CardHeader>
          <CardTitle>Delete Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Account deletion is non-reversible. Please proceed with caution.
          </p>
          <form onSubmit={handleDeleteSubmit} className="space-y-4">
            {!user?.githubId && (
              <div>
                <Label htmlFor="delete-password">Confirm Password</Label>
                <Input
                  id="delete-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={100}
                />
              </div>
            )}
            {deleteState.error && (
              <p className="text-red-500 text-sm">{deleteState.error}</p>
            )}
            <Button
              type="submit"
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeletePending}
            >
              {isDeletePending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
