'use client'

import { resendEmailVerificationCodeAction, verifyEmailAction } from './actions'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

type ActionState = {
  error?: string
  success?: string
}

export function EmailVerificationForm() {
  const [verifyEmailState, verifyEmailFormAction, isVerifyEmailPending] =
    useActionState<ActionState, FormData>(verifyEmailAction, {
      error: '',
      success: '',
    })

  return (
    <form action={verifyEmailFormAction} className="w-full max-w-sm">
      <Label htmlFor="form-verify.code">Code</Label>
      <Input id="form-verify.code" name="code" required className="mb-2" />
      <Button className="bg-primary hover:bg-primary-700 w-full sm:w-auto">
        {isVerifyEmailPending ? (
          <div className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Verifying...</span>
          </div>
        ) : (
          'Verify'
        )}
      </Button>
      {verifyEmailState.error && (
        <p className="mt-2 text-red-500">{verifyEmailState.error}</p>
      )}
      {verifyEmailState.success && (
        <p className="mt-2 text-green-500">{verifyEmailState.success}</p>
      )}
    </form>
  )
}

export function ResendEmailVerificationCodeForm() {
  const [ResendverificationCodeState, ResendverificationCodeFormAction, _] =
    useActionState<ActionState, FormData>(resendEmailVerificationCodeAction, {
      error: '',
      success: '',
    })

  return (
    <form action={ResendverificationCodeFormAction}>
      <Button className="bg-secondary bg-white hover:bg-gray-50 focus:outline-none text-gray-700">
        Resend code
      </Button>
      {ResendverificationCodeState.error && (
        <p className="mt-2 text-red-500">{ResendverificationCodeState.error}</p>
      )}
      {ResendverificationCodeState.success && (
        <p className="mt-2 text-green-500">
          {ResendverificationCodeState.success}
        </p>
      )}
    </form>
  )
}
