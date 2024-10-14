'use client'

import { useFormState } from 'react-dom'
import { verifyPasswordResetEmailAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const initialPasswordResetEmailVerificationState = {
  message: '',
}

export function PasswordResetEmailVerificationForm() {
  const [state, action] = useFormState(
    verifyPasswordResetEmailAction,
    initialPasswordResetEmailVerificationState
  )
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Verify Email Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div>
            <Label
              htmlFor="form-verify.code"
              className="block text-sm font-medium text-foreground"
            >
              Code
            </Label>
            <Input
              id="form-verify.code"
              name="code"
              type="text"
              required
              className="mt-1 block w-full"
              placeholder="Enter verification code"
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
