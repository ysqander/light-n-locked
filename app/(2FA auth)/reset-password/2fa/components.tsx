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
              className="block text-sm font-medium text-foreground"
            >
              TOTP Code
            </Label>
            <Input
              id="form-totp.code"
              name="code"
              type="text"
              required
              className="mt-1 block w-full"
              placeholder="Enter your TOTP code"
            />
          </div>
          <Button type="submit" className="w-full">
            Verify
          </Button>
          {state.message && (
            <p className="mt-2 text-sm text-destructive">{state.message}</p>
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
              className="block text-sm font-medium text-foreground"
            >
              Recovery Code
            </Label>
            <Input
              id="form-recovery-code.code"
              name="code"
              type="text"
              required
              className="mt-1 block w-full"
              placeholder="Enter your recovery code"
            />
          </div>
          <Button type="submit" className="w-full">
            Verify
          </Button>
          {state.message && (
            <p className="mt-2 text-sm text-destructive">{state.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
