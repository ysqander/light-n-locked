'use client'

import { useFormState } from 'react-dom'
import {
  verifyPasswordReset2FAWithRecoveryCodeAction,
  verifyPasswordReset2FAWithTOTPAction,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const initialPasswordResetTOTPState = {
  message: '',
}

export function PasswordResetTOTPForm() {
  const [state, action] = useFormState(
    verifyPasswordReset2FAWithTOTPAction,
    initialPasswordResetTOTPState
  )
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Verify TOTP Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div>
            <Label
              htmlFor="form-totp.code"
              className="block text-sm font-medium text-gray-700"
            >
              TOTP Code
            </Label>
            <Input
              id="form-totp.code"
              name="code"
              type="text"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              placeholder="Enter your TOTP code"
            />
          </div>
          <Button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Verify
          </Button>
          {state.message && (
            <p className="mt-2 text-sm text-red-600">{state.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

const initialPasswordResetRecoveryCodeState = {
  message: '',
}

export function PasswordResetRecoveryCodeForm() {
  const [state, action] = useFormState(
    verifyPasswordReset2FAWithRecoveryCodeAction,
    initialPasswordResetRecoveryCodeState
  )
  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Verify Recovery Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div>
            <Label
              htmlFor="form-recovery-code.code"
              className="block text-sm font-medium text-gray-700"
            >
              Recovery Code
            </Label>
            <Input
              id="form-recovery-code.code"
              name="code"
              type="text"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              placeholder="Enter your recovery code"
            />
          </div>
          <Button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Verify
          </Button>
          {state.message && (
            <p className="mt-2 text-sm text-red-600">{state.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
