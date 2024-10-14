import { PasswordResetForm } from './components'
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
  if (user.registered2FA && !session.twoFactorVerified) {
    return redirect('/reset-password/2fa')
  }
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          Reset Your Password
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Enter New Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              Please enter a new, strong password for your account.
            </p>
            <PasswordResetForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
