import { InfoIcon } from 'lucide-react'
import { PasswordResetTOTPForm } from './components'
import { validatePasswordResetSessionRequest } from '@/lib/server/password-reset'
import { globalGETRateLimit } from '@/lib/server/request'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import RecoveryCodeToggle from './components'

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
        <h1 className="mt-6 text-center text-3xl font-extrabold text-primary">
          Two-factor authentication
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border-l-4 border-l-primary shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <InfoIcon className="w-5 h-5 mr-2 text-primary" />
              Enter TOTP Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter the code from your authenticator app.
            </p>
            <PasswordResetTOTPForm />
            <RecoveryCodeToggle />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
