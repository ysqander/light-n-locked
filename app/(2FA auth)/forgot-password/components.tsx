'use client'

import { useActionState, startTransition } from 'react'
import { forgotPasswordAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type ActionState = {
  error?: string
  success?: string
}

export function ForgotPasswordForm() {
  const router = useRouter()
  const [state, action, isPending] = useActionState<ActionState, FormData>(
    forgotPasswordAction,
    { error: '', success: '' }
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => {
      action(formData)
    })
  }

  useEffect(() => {
    if (state.success) {
      router.push('/reset-password/verify-email')
    }
  }, [state.success])

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Get Reset Link
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              placeholder="Enter your email address"
            />
          </div>
          <Button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            disabled={isPending}
          >
            {isPending ? (
              <div>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </div>
            ) : (
              'Send Reset Link'
            )}
          </Button>
          {state.error && (
            <p className={`mt-2 text-sm text-red-600`}>{state.error}</p>
          )}
          {state.success && (
            <p className={`mt-2 text-sm text-green-600`}>{state.success}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
