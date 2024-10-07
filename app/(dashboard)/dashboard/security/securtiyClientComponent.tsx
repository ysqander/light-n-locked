'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Trash2, Loader2 } from 'lucide-react'
import { startTransition, useActionState } from 'react'
import { deleteAccount, requestPasswordReset } from '@/app/(login)/actions'
import React from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { User } from 'lucia'

type ActionState = {
  error?: string
  success?: string
}

interface SecurityClientComponentProps {
  user: User
}

export default function SecurityClientComponent({
  user,
}: SecurityClientComponentProps) {
  const [resetState, resetAction, isResetPending] = useActionState<
    ActionState,
    FormData
  >(requestPasswordReset, { error: '', success: '' })

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    ActionState,
    FormData
  >(deleteAccount, { error: '', success: '' })

  const router = useRouter()

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

  useEffect(() => {
    if (deleteState.success) {
      router.push('/')
    }
  }, [deleteState.success, router])

  return (
    <>
      {/* Password Reset Section */}
      {!user.githubId && (
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
            <div>
              <Label htmlFor="confirm-delete">
                Type "CONFIRM DELETE" to proceed
              </Label>
              <Input
                id="confirm-delete"
                name="confirmText"
                type="text"
                required
                placeholder=""
              />
            </div>
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
    </>
  )
}
