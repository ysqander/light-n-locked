import {
  PasswordResetRecoveryCodeForm,
  PasswordResetTOTPForm,
} from './components'

import { validatePasswordResetSessionRequest } from '@/lib/server/password-reset'
import { globalGETRateLimit } from '@/lib/server/request'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function Page() {
  if (!globalGETRateLimit()) {
    return 'Too many requests'
  }
  const { session, user } = await validatePasswordResetSessionRequest()

  if (session === null) {
    return redirect('/forgot-password')
  }
  if (!session.emailVerified) {
    return redirect('/reset-password/verify-email')
  }
  if (!user.registered2FA) {
    return redirect('/reset-password')
  }
  if (session.twoFactorVerified) {
    return redirect('/reset-password')
  }
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          Two-factor authentication
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Enter TOTP Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter the code from your authenticator app.
            </p>
            <PasswordResetTOTPForm />
          </CardContent>
        </Card>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-background text-muted-foreground">Or</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Use Recovery Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              If you can't access your authenticator app, you can use the
              recovery code generated on signup instead.
            </p>
            <PasswordResetRecoveryCodeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
