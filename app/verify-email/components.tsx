'use client'

import { resendEmailVerificationCodeAction, verifyEmailAction } from './actions'
import { useFormState } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const emailVerificationInitialState = {
  message: '',
}

export function EmailVerificationForm() {
  const [state, action] = useFormState(
    verifyEmailAction,
    emailVerificationInitialState
  )
  return (
    <form action={action} className="w-full max-w-sm">
      <Label htmlFor="form-verify.code">Code</Label>
      <Input id="form-verify.code" name="code" required className="mb-2" />
      <Button className="bg-primary hover:bg-primary-700 w-full sm:w-auto">
        Verify
      </Button>
      <p className="mt-2">{state.message}</p>
    </form>
  )
}

const resendEmailInitialState = {
  message: '',
}

export function ResendEmailVerificationCodeForm() {
  const [state, action] = useFormState(
    resendEmailVerificationCodeAction,
    resendEmailInitialState
  )
  return (
    <form action={action}>
      <Button className="bg-secondary bg-white hover:bg-gray-50 focus:outline-none text-gray-700">
        Resend code
      </Button>
      <p>{state.message}</p>
    </form>
  )
}
