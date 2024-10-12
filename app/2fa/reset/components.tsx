'use client'

import { reset2FAAction } from './actions'
import { useFormState } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initial2FAResetState = {
  message: '',
}

export function TwoFactorResetForm() {
  const [state, action] = useFormState(reset2FAAction, initial2FAResetState)

  return (
    <form action={action} className="space-y-6">
      <div>
        <Label
          htmlFor="form-totp.code"
          className="block text-sm font-medium text-gray-700"
        >
          Enter Backup Code
        </Label>
        <div className="mt-1">
          <Input
            id="form-totp.code"
            name="code"
            required
            className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
            placeholder="Enter your backup code"
          />
        </div>
      </div>
      <div>
        <Button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          Reset 2FA
        </Button>
      </div>
      {state.message && (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      )}
    </form>
  )
}
