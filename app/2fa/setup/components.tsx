'use client'

import { setup2FAAction } from './actions'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const initial2FASetUpState: ActionState = {
  success: '',
  error: '',
}

type ActionState = {
  success?: string
  error?: string
}

export function TwoFactorSetUpForm(props: { encodedTOTPKey: string }) {
  console.log('DEBUG: TwoFactorSetUpForm rendered', {
    encodedTOTPKey: props.encodedTOTPKey,
  })

  const [actionState, formAction, pending] = useActionState<
    ActionState,
    FormData
  >(setup2FAAction, initial2FASetUpState, 'setup-2fa')

  const router = useRouter()

  useEffect(() => {
    if (actionState.success) {
      router.push('/recovery-code')
    }
  }, [actionState, router])

  return (
    <form action={formAction} className="space-y-6">
      <input name="key" defaultValue={props.encodedTOTPKey} hidden readOnly />
      <div>
        <Label
          htmlFor="form-totp.code"
          className="block text-sm font-medium text-gray-700"
        >
          Verify the code from the app
        </Label>
        <div className="mt-1">
          <Input
            id="form-totp.code"
            name="code"
            required
            className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
            placeholder="Enter the code"
          />
        </div>
      </div>
      <div>
        <Button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          {pending ? (
            <div>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Saving...
            </div>
          ) : (
            'Save'
          )}
        </Button>
      </div>
      {actionState.success && (
        <p className="mt-2 text-sm text-green-600">{actionState.success}</p>
      )}
      {actionState.error && (
        <p className="mt-2 text-sm text-red-600">{actionState.error}</p>
      )}
    </form>
  )
}
