'use client'

import { useActionState } from 'react'
import { resetPasswordAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type ActionState = {
  error?: string
  success?: string
}

export function PasswordResetForm() {
  const [resetState, resetAction, isResetPending] = useActionState<
    ActionState,
    FormData
  >(resetPasswordAction, { error: '', success: '' })

  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMismatch, setPasswordMismatch] = useState(false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password === confirmPassword) {
      setPasswordMismatch(false)
      const formData = new FormData(event.currentTarget)
      resetAction(formData)
    } else {
      setPasswordMismatch(true)
    }
  }

  useEffect(() => {
    if (resetState.success) {
      router.push('/dashboard')
    }
  }, [resetState.success, router])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          New Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 block w-full"
          placeholder="Enter your new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <Label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-foreground"
        >
          Confirm New Password
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          className="mt-1 block w-full"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      {passwordMismatch && (
        <p className="text-sm text-destructive">Passwords do not match</p>
      )}
      <Button type="submit" className="w-full" disabled={isResetPending}>
        {isResetPending ? 'Resetting...' : 'Reset Password'}
      </Button>
      {resetState.error && (
        <p className="mt-2 text-sm text-destructive">{resetState.error}</p>
      )}
      {resetState.success && (
        <p className="mt-2 text-sm text-green-600">{resetState.success}</p>
      )}
    </form>
  )
}
